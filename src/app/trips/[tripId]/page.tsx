"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { buildClientExportCSV, buildClientExportJSON, downloadFile } from "@/lib/export-format";
import { safeFetch } from "@/lib/fetch";
import { useLocale } from "@/lib/i18n/context";
import {
  calculatePairwiseBreakdown,
  calculatePersonSettlementGroups,
  calculateSuggestedSettlements,
  exportSettlementSummaryAsText,
  type SuggestedSettlement,
} from "@/lib/settlement";
import { formatDateForInput } from "@/lib/utils";
import { ActivityView } from "./components/ActivityView";
import { AddExpenseForm } from "./components/AddExpenseForm";
import { BackupCard } from "./components/BackupCard";
import { ExpenseList } from "./components/ExpenseList";
import { createDefaultExpenseForm, buildSplits } from "./components/helpers";
import { MembersCard } from "./components/MembersCard";
import { MobileTabBar } from "./components/MobileTabBar";
import { SettlementView } from "./components/SettlementView";
import { StatsView } from "./components/StatsView";
import { TabNavigation } from "./components/TabNavigation";
import { TripHeader } from "./components/TripHeader";
import { TripSummaryView } from "./components/TripSummaryView";
import { exportSettlementImage, exportSettlementPDF } from "./components/settlementExports";
import {
  EMPTY_FILTERS,
  type ActivityLog,
  type Expense,
  type ExpenseFilters,
  type ExpenseFormState,
  type Tab,
  type Trip,
} from "./components/types";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocale();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("expenses");
  const [showInvite, setShowInvite] = useState(false);
  const [newMember, setNewMember] = useState("");
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(createDefaultExpenseForm());
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [exportingToNotion, setExportingToNotion] = useState(false);
  const [completingSettlement, setCompletingSettlement] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<
    { id: string; value: string; label: string; emoji: string }[]
  >([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📝");

  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(""), 8000);
  }, []);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await safeFetch(`/api/trips/${tripId}`);

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setLoading(false);
      return;
    }

    if (res.status === 401) {
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("errors.loadFailed") }));
      showError(data.error || t("errors.loadFailed"));
      setLoading(false);
      return;
    }

    const data = await res.json();
    setTrip(data);
    setExpenseForm((prev) => {
      if (!prev.paidById && data.currentMemberId) {
        return createDefaultExpenseForm(data.currency, data.currentMemberId);
      }

      return prev;
    });
    setLoading(false);
  }, [router, showError, t, tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    const res = await safeFetch(`/api/trips/${tripId}/activities`);

    if (res.ok) {
      const data = await res.json();
      setActivities(data);
    }
    setActivitiesLoading(false);
  }, [tripId]);

  const fetchCustomCategories = useCallback(async () => {
    const res = await safeFetch(`/api/trips/${tripId}/categories`);
    if (res.ok) {
      const data = await res.json();
      setCustomCategories(data);
    }
  }, [tripId]);

  useEffect(() => {
    if (trip) fetchCustomCategories();
  }, [fetchCustomCategories, trip]);

  const allCategories = useMemo(() => {
    const defaults = EXPENSE_CATEGORIES.map((c) => ({
      value: c.value,
      label: c.label,
      emoji: c.emoji,
      isCustom: false,
    }));
    const customs = customCategories.map((c) => ({
      value: c.value,
      label: c.label,
      emoji: c.emoji,
      isCustom: true,
    }));
    return [...defaults, ...customs];
  }, [customCategories]);

  const addCustomCategory = async () => {
    if (!newCategoryValue.trim() || !newCategoryLabel.trim()) return;
    const res = await safeFetch(`/api/trips/${tripId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: newCategoryValue.trim(),
        label: newCategoryLabel.trim(),
        emoji: newCategoryEmoji || "📝",
      }),
    });
    if (res.ok) {
      setNewCategoryValue("");
      setNewCategoryLabel("");
      setNewCategoryEmoji("📝");
      fetchCustomCategories();
    } else {
      const data = await res.json().catch(() => ({ error: "新增類別失敗" }));
      showError(data.error || "新增類別失敗");
    }
  };

  const deleteCustomCategory = async (categoryId: string) => {
    if (!confirm("確定要刪除此自訂類別？")) return;
    const res = await safeFetch(`/api/trips/${tripId}/categories/${categoryId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchCustomCategories();
    } else {
      const data = await res.json().catch(() => ({ error: "刪除類別失敗" }));
      showError(data.error || "刪除類別失敗");
    }
  };

  useEffect(() => {
    if (tab === "activity") fetchActivities();
  }, [fetchActivities, tab]);

  const suggestedSettlements = useMemo(() => {
    if (!trip) return [];
    return calculateSuggestedSettlements(trip.members, trip.expenses, trip.payments);
  }, [trip]);

  const pairwiseBreakdowns = useMemo(() => {
    if (!trip) return [];
    return calculatePairwiseBreakdown(trip.expenses);
  }, [trip]);

  const personSettlementGroups = useMemo(() => {
    if (!trip) return [];
    return calculatePersonSettlementGroups(trip.members, pairwiseBreakdowns);
  }, [pairwiseBreakdowns, trip]);

  const totalExpenses = trip?.expenses.reduce((sum, expense) => sum + expense.amount * expense.exchangeRate, 0) ?? 0;

  const filteredExpenses = useMemo(() => {
    if (!trip) return [];
    let result = trip.expenses;

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter(
        (e) => e.description.toLowerCase().includes(kw) || (e as Expense).note?.toLowerCase().includes(kw)
      );
    }

    if (filters.category) result = result.filter((e) => e.category === filters.category);
    if (filters.paidById) result = result.filter((e) => e.paidBy.id === filters.paidById);
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((e) => new Date(e.date) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + "T23:59:59");
      result = result.filter((e) => new Date(e.date) <= to);
    }

    return result;
  }, [filters, trip]);

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount * e.exchangeRate, 0),
    [filteredExpenses]
  );

  const hasActiveFilters = filters.keyword || filters.category || filters.paidById || filters.dateFrom || filters.dateTo;

  const resetExpenseForm = useCallback(() => {
    setEditingExpenseId(null);
    setExpenseForm(createDefaultExpenseForm(trip?.currency || "TWD", trip?.currentMemberId || ""));
    setCustomSplits({});
  }, [trip?.currency, trip?.currentMemberId]);

  const addMember = async () => {
    if (!newMember.trim() || !trip?.permissions.canManageMembers) return;

    const res = await safeFetch(`/api/trips/${tripId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMember.trim() }),
    });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("errors.addMemberFailed") }));
      showError(data.error || t("errors.addMemberFailed"));
      return;
    }

    setNewMember("");
    fetchTrip();
  };

  const removeMember = async (memberId: string) => {
    if (!trip?.permissions.canManageMembers) return;
    if (!confirm(t("confirms.removeMember"))) return;

    const res = await safeFetch(`/api/trips/${tripId}/members?memberId=${memberId}`, { method: "DELETE" });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("errors.removeMemberFailed") }));
      showError(data.error || t("errors.removeMemberFailed"));
      return;
    }

    fetchTrip();
  };

  const submitExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    setSaving(true);
    setError("");

    const splits = buildSplits(expenseForm, trip.members, customSplits);
    const endpoint = editingExpenseId
      ? `/api/trips/${tripId}/expenses/${editingExpenseId}`
      : `/api/trips/${tripId}/expenses`;
    const method = editingExpenseId ? "PATCH" : "POST";

    const res = await safeFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...expenseForm,
        exchangeRate: expenseForm.exchangeRate || "1",
        splits,
      }),
    });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setSaving(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("expense.saveFailed") }));
      showError(data.error || t("expense.saveFailed"));
      setSaving(false);
      return;
    }

    resetExpenseForm();
    setSaving(false);
    setTab("expenses");
    fetchTrip();
  };

  const startEditingExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      amount: String(expense.amount),
      currency: expense.currency,
      category: expense.category,
      description: expense.description,
      note: expense.note || "",
      settlementMode: expense.settlementMode || "normal",
      settlementNote: expense.settlementNote || "",
      date: formatDateForInput(expense.date),
      paidById: expense.paidBy.id,
      splitType: expense.splitType,
      receiptUrl: expense.receiptUrl || "",
      exchangeRate: String(expense.exchangeRate),
    });
    setCustomSplits(
      expense.splits.reduce<Record<string, string>>((acc, split) => {
        if (expense.splitType === "percentage") {
          acc[split.member.id] = ((split.amount / expense.amount) * 100).toFixed(2);
        } else {
          acc[split.member.id] = String(split.amount);
        }
        return acc;
      }, {})
    );
    setTab("add");
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm(t("expense.confirmDelete"))) return;
    const res = await safeFetch(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("expense.deleteFailed") }));
      showError(data.error || t("expense.deleteFailed"));
      return;
    }

    fetchTrip();
  };

  const deleteTrip = async () => {
    if (!trip?.permissions.canDeleteTrip) return;
    if (!confirm(t("confirms.deleteTrip"))) return;

    const res = await safeFetch(`/api/trips/${tripId}`, { method: "DELETE" });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("errors.deleteTripFailed") }));
      showError(data.error || t("errors.deleteTripFailed"));
      return;
    }

    router.push("/");
  };

  const markSettlementPaid = async (settlement: SuggestedSettlement) => {
    const note = window.prompt(t("settlement.promptPaymentNote"), "") ?? "";
    setProcessingPayment(`${settlement.fromMemberId}:${settlement.toMemberId}`);
    const res = await safeFetch(`/api/trips/${tripId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        amount: settlement.amount,
        note,
      }),
    });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setProcessingPayment(null);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("settlement.markFailed") }));
      showError(data.error || t("settlement.markFailed"));
      setProcessingPayment(null);
      return;
    }

    setProcessingPayment(null);
    fetchTrip();
  };

  const togglePaymentStatus = async (paymentId: string, status: "completed" | "cancelled") => {
    setProcessingPayment(paymentId);
    const res = await safeFetch(`/api/trips/${tripId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setProcessingPayment(null);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t("settlement.updateFailed") }));
      showError(data.error || t("settlement.updateFailed"));
      setProcessingPayment(null);
      return;
    }

    setProcessingPayment(null);
    fetchTrip();
  };

  const exportSettlementDetails = () => {
    if (!trip) return;
    const content = exportSettlementSummaryAsText(personSettlementGroups, trip.payments);
    downloadFile(content, `${trip.name}-settlement-summary.txt`, "text/plain");
  };

  const exportPDF = async () => {
    if (!trip) return;
    await exportSettlementPDF({ trip, totalExpenses, suggestedSettlements, personSettlementGroups });
  };

  const exportSettlementScreenshot = async () => {
    if (!trip) return;
    await exportSettlementImage({ trip, totalExpenses, suggestedSettlements });
  };

  const triggerBackup = async () => {
    setBackingUp(true);
    const res = await safeFetch(`/api/trips/${tripId}/backup`, { method: "POST" });
    if (res.ok) {
      showError("");
      alert("伺服器備份已建立！");
    } else {
      const data = await res.json().catch(() => ({ error: "備份失敗" }));
      showError(data.error || "備份失敗");
    }
    setBackingUp(false);
  };

  const exportToNotion = async () => {
    if (!trip?.permissions.isOwner) return;

    setExportingToNotion(true);
    const res = await safeFetch(`/api/trips/${tripId}/notion`, { method: "POST" });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setExportingToNotion(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "匯出到 Notion 失敗" }));
      showError(data.error || "匯出到 Notion 失敗");
      setExportingToNotion(false);
      return;
    }

    const data = (await res.json().catch(() => null)) as { pageUrl?: string } | null;
    if (data?.pageUrl) window.open(data.pageUrl, "_blank", "noopener,noreferrer");

    alert("已成功匯出到 Notion！");
    setExportingToNotion(false);
  };

  const completeSettlement = async () => {
    if (!trip?.permissions.isOwner || completingSettlement) return;

    const confirmed = window.confirm("確認結算完成並推播給尚未付款的成員嗎？每位成員在這趟旅程只會收到一次摘要推播。");
    if (!confirmed) return;

    setCompletingSettlement(true);
    const res = await safeFetch(`/api/trips/${tripId}/settlement-reminder`, { method: "POST" });

    if (res.status === 0) {
      showError(t("errors.networkFailed"));
      setCompletingSettlement(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "結算推播失敗" }));
      showError(data.error || "結算推播失敗");
      setCompletingSettlement(false);
      return;
    }

    const data = await res.json().catch(() => ({ attempted: 0, sent: 0, failed: 0 }));
    alert(`結算推播完成：已嘗試 ${data.attempted ?? 0} 人，成功 ${data.sent ?? 0} 人，失敗 ${data.failed ?? 0} 人`);
    setCompletingSettlement(false);
    fetchTrip();
  };

  const exportJSON = () => {
    if (!trip) return;
    const data = buildClientExportJSON(trip);
    downloadFile(JSON.stringify(data, null, 2), `${trip.name}-backup.json`, "application/json");
  };

  const exportCSV = () => {
    if (!trip) return;
    const csv = buildClientExportCSV(trip, customCategories);
    downloadFile(csv, `${trip.name}-expenses.csv`, "text/csv");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mb-3 text-4xl animate-bounce">✈️</div>
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-4 text-6xl">😵</div>
        <p className="mb-4 text-center text-gray-500">{error || t("trip.notFound")}</p>
        <div className="flex gap-3">
          <button
            onClick={fetchTrip}
            className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            {t("common.reload")}
          </button>
          <Link href="/" className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-300">
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <TripHeader
        trip={trip}
        showInvite={showInvite}
        onToggleInvite={() => setShowInvite((prev) => !prev)}
        onDeleteTrip={deleteTrip}
      />

      <div className="mx-auto max-w-4xl px-4 pb-8">
        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
            <span>{error}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={fetchTrip}
                className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-200"
              >
                  {t("common.retry")}
              </button>
              <button onClick={() => setError("")} className="text-red-300 hover:text-red-500">
                ✕
              </button>
            </div>
          </div>
        )}

        <MembersCard
          trip={trip}
          newMember={newMember}
          setNewMember={setNewMember}
          onAddMember={addMember}
          onRemoveMember={removeMember}
        />

        <TabNavigation trip={trip} tab={tab} setTab={setTab} editingExpenseId={editingExpenseId} />

        <div className="mt-4 pb-24 sm:pb-4">
          {tab === "expenses" && (
            <ExpenseList
              expenses={filteredExpenses}
              allExpenses={trip.expenses}
              currency={trip.currency}
              totalExpenses={hasActiveFilters ? filteredTotal : totalExpenses}
              currentUserId={trip.currentUser.id}
              isOwner={trip.permissions.isOwner}
              members={trip.members}
              filters={filters}
              setFilters={setFilters}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              hasActiveFilters={!!hasActiveFilters}
              onEdit={startEditingExpense}
              onDelete={deleteExpense}
              customCategories={customCategories}
            />
          )}

          {tab === "add" && (
            <AddExpenseForm
              members={trip.members}
              tripCurrency={trip.currency}
              form={expenseForm}
              setForm={setExpenseForm}
              customSplits={customSplits}
              setCustomSplits={setCustomSplits}
              saving={saving}
              onSubmit={submitExpense}
              onCancel={editingExpenseId ? resetExpenseForm : undefined}
                submitLabel={editingExpenseId ? t("expense.submitEdit") : t("expense.submitCreate")}
              onError={showError}
              allCategories={allCategories}
              customCategories={customCategories}
              showCategoryManager={showCategoryManager}
              onToggleCategoryManager={() => setShowCategoryManager((prev) => !prev)}
              newCategoryValue={newCategoryValue}
              setNewCategoryValue={setNewCategoryValue}
              newCategoryLabel={newCategoryLabel}
              setNewCategoryLabel={setNewCategoryLabel}
              newCategoryEmoji={newCategoryEmoji}
              setNewCategoryEmoji={setNewCategoryEmoji}
              onAddCustomCategory={addCustomCategory}
              onDeleteCustomCategory={deleteCustomCategory}
              isOwner={trip.permissions.isOwner}
            />
          )}

          {tab === "settle" && (
            <>
              <SettlementView
                currency={trip.currency}
                totalExpenses={totalExpenses}
                members={trip.members}
                expenses={trip.expenses}
                payments={trip.payments}
                settlements={suggestedSettlements}
                pairwiseBreakdowns={pairwiseBreakdowns}
                personSettlementGroups={personSettlementGroups}
                expandedBreakdowns={expandedBreakdowns}
                onToggleBreakdown={(key) => setExpandedBreakdowns((prev) => ({ ...prev, [key]: !prev[key] }))}
                onMarkPaid={markSettlementPaid}
                onTogglePaymentStatus={togglePaymentStatus}
                processingPayment={processingPayment}
                onExport={exportSettlementDetails}
                onExportJSON={exportJSON}
                onExportCSV={exportCSV}
                onExportPDF={exportPDF}
                onExportImage={exportSettlementScreenshot}
                customCategories={customCategories}
                canExportToNotion={trip.permissions.isOwner}
                exportingToNotion={exportingToNotion}
                onExportToNotion={exportToNotion}
                canCompleteSettlement={trip.permissions.isOwner}
                completingSettlement={completingSettlement}
                onCompleteSettlement={completeSettlement}
              />
              {trip.permissions.isOwner && <BackupCard backingUp={backingUp} onTriggerBackup={triggerBackup} />}
            </>
          )}

          {tab === "summary" && (
            <TripSummaryView
              trip={trip}
              totalExpenses={totalExpenses}
              settlements={suggestedSettlements}
              customCategories={customCategories}
            />
          )}

          {tab === "stats" && (
            <StatsView expenses={trip.expenses} currency={trip.currency} customCategories={customCategories} />
          )}

          {tab === "activity" && (
            <ActivityView activities={activities} loading={activitiesLoading} onRefresh={fetchActivities} />
          )}
        </div>

        <MobileTabBar tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
