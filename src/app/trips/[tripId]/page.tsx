"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, EXPENSE_CATEGORIES, SPLIT_TYPES } from "@/lib/constants";
import {
  calculatePairwiseBreakdown,
  calculatePersonSettlementGroups,
  calculateSuggestedSettlements,
  exportSettlementSummaryAsText,
  type PairwiseBreakdown,
  type RecordedSettlementPayment,
  type SettlementExpense,
  type SuggestedSettlement,
} from "@/lib/settlement";
import { formatCurrency, formatDate, formatDateForInput } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";

type User = {
  id: string;
  name: string;
  email: string;
};

type Member = {
  id: string;
  name: string;
  userId: string | null;
  user?: User | null;
};

type Split = {
  id: string;
  amount: number;
  member: Member;
};

type Expense = SettlementExpense & {
  note: string | null;
  settlementMode: string;
  settlementNote: string | null;
  receiptUrl: string | null;
  splitType: string;
  createdBy: User | null;
};

type Payment = RecordedSettlementPayment & {
  settledBy: User;
};

type TripPermissions = {
  isOwner: boolean;
  canManageMembers: boolean;
  canDeleteTrip: boolean;
  canAddExpense: boolean;
};

type Trip = {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string | null;
  currency: string;
  coverEmoji: string;
  inviteCode: string;
  owner: User | null;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  permissions: TripPermissions;
  currentUser: User;
  currentMemberId: string | null;
};

type ActivityLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type Tab = "expenses" | "add" | "settle" | "summary" | "stats" | "activity";

type ExpenseFilters = {
  keyword: string;
  category: string;
  paidById: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: ExpenseFilters = {
  keyword: "",
  category: "",
  paidById: "",
  dateFrom: "",
  dateTo: "",
};

const createDefaultExpenseForm = (currency = "TWD", paidById = "") => ({
  amount: "",
  currency,
  category: "food",
  description: "",
  note: "",
  settlementMode: "normal",
  settlementNote: "",
  date: formatDateForInput(new Date()),
  paidById,
  splitType: "equal",
  receiptUrl: "",
  exchangeRate: "1",
});

type ExpenseFormState = ReturnType<typeof createDefaultExpenseForm>;

function getCategoryInfo(value: string, customCats?: { value: string; label: string; emoji: string }[]) {
  const found = EXPENSE_CATEGORIES.find((category) => category.value === value);
  if (found) return found;
  const custom = customCats?.find((c) => c.value === value);
  if (custom) return custom;
  return { value: "other", label: "其他", emoji: "📝" };
}

function buildSplits(
  form: ExpenseFormState,
  members: Member[],
  customSplits: Record<string, string>
) {
  const amount = parseFloat(form.amount || "0");

  if (form.splitType === "equal") {
    const perPerson = members.length > 0 ? amount / members.length : 0;
    return members.map((member) => ({
      memberId: member.id,
      amount: Math.round(perPerson * 100) / 100,
    }));
  }

  if (form.splitType === "payer_only") {
    return [{ memberId: form.paidById, amount }];
  }

  if (form.splitType === "percentage") {
    return members
      .filter((member) => customSplits[member.id] && parseFloat(customSplits[member.id]) > 0)
      .map((member) => ({
        memberId: member.id,
        amount: Math.round(amount * (parseFloat(customSplits[member.id]) / 100) * 100) / 100,
      }));
  }

  return members
    .filter((member) => customSplits[member.id] && parseFloat(customSplits[member.id]) > 0)
    .map((member) => ({
      memberId: member.id,
      amount: parseFloat(customSplits[member.id]),
    }));
}

function getActivityLabel(action: string): string {
  const map: Record<string, string> = {
    expense_created: "新增消費",
    expense_updated: "修改消費",
    expense_deleted: "刪除消費",
    payment_marked: "標記付款",
    payment_updated: "更新付款狀態",
    member_added: "新增成員",
    member_removed: "移除成員",
    backup_imported: "匯入備份",
    backup_exported: "匯出備份",
    notification_generated: "通知產生",
  };
  return map[action] || action;
}

function getActivityEmoji(action: string): string {
  const map: Record<string, string> = {
    expense_created: "➕",
    expense_updated: "✏️",
    expense_deleted: "🗑️",
    payment_marked: "💸",
    payment_updated: "🔄",
    member_added: "👤",
    member_removed: "👋",
    backup_imported: "♻️",
    backup_exported: "💾",
    notification_generated: "🔔",
  };
  return map[action] || "📋";
}

function buildTripExportJSON(trip: Trip) {
  return {
    exportedAt: new Date().toISOString(),
    trip: {
      name: trip.name,
      description: trip.description,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currency: trip.currency,
      coverEmoji: trip.coverEmoji,
    },
    members: trip.members.map((m) => ({ name: m.name })),
    expenses: trip.expenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      exchangeRate: e.exchangeRate,
      category: e.category,
      date: e.date,
      paidBy: e.paidBy.name,
      splitType: e.splitType,
      note: (e as Expense).note,
      settlementMode: (e as Expense).settlementMode,
      settlementNote: (e as Expense).settlementNote,
      splits: e.splits.map((s) => ({
        member: s.member.name,
        amount: s.amount,
      })),
    })),
    payments: trip.payments.map((p) => ({
      from: p.fromMember.name,
      to: p.toMember.name,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      settledAt: p.settledAt,
      note: p.note,
    })),
  };
}

function buildTripExportCSV(trip: Trip, customCats?: { value: string; label: string; emoji: string }[]) {
  const header = [
    "日期",
    "說明",
    "金額",
    "幣別",
    "匯率",
    "等值金額",
    "類別",
    "付款人",
    "分帳方式",
    "備註",
  ].join(",");

  const rows = trip.expenses.map((e) => {
    const cat = getCategoryInfo(e.category, customCats);
    return [
      formatDateForInput(e.date),
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.currency,
      e.exchangeRate,
      (e.amount * e.exchangeRate).toFixed(2),
      cat.label,
      e.paidBy.name,
      e.splitType,
      `"${((e as Expense).note || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  return "\uFEFF" + [header, ...rows].join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<{ id: string; value: string; label: string; emoji: string }[]>([]);
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
      showError("網路連線失敗，請檢查網路後重試");
      setLoading(false);
      return;
    }

    if (res.status === 401) {
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "載入失敗" }));
      showError(data.error || "載入失敗");
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
  }, [router, tripId, showError]);

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
    if (trip) {
      fetchCustomCategories();
    }
  }, [trip, fetchCustomCategories]);

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
    if (tab === "activity") {
      fetchActivities();
    }
  }, [tab, fetchActivities]);

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
  }, [trip, pairwiseBreakdowns]);

  const totalExpenses =
    trip?.expenses.reduce((sum, expense) => sum + expense.amount * expense.exchangeRate, 0) ?? 0;

  const filteredExpenses = useMemo(() => {
    if (!trip) return [];
    let result = trip.expenses;

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(kw) ||
          (e as Expense).note?.toLowerCase().includes(kw)
      );
    }

    if (filters.category) {
      result = result.filter((e) => e.category === filters.category);
    }

    if (filters.paidById) {
      result = result.filter((e) => e.paidBy.id === filters.paidById);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((e) => new Date(e.date) >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo + "T23:59:59");
      result = result.filter((e) => new Date(e.date) <= to);
    }

    return result;
  }, [trip, filters]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount * e.exchangeRate, 0);
  }, [filteredExpenses]);

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
      showError("網路連線失敗，請檢查網路後重試");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "新增成員失敗" }));
      showError(data.error || "新增成員失敗");
      return;
    }

    setNewMember("");
    fetchTrip();
  };

  const removeMember = async (memberId: string) => {
    if (!trip?.permissions.canManageMembers) return;
    if (!confirm("確定要移除此成員？")) return;

    const res = await safeFetch(`/api/trips/${tripId}/members?memberId=${memberId}`, {
      method: "DELETE",
    });

    if (res.status === 0) {
      showError("網路連線失敗，請檢查網路後重試");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "移除成員失敗" }));
      showError(data.error || "移除成員失敗");
      return;
    }

    fetchTrip();
  };

  const submitExpense = async (e: React.FormEvent) => {
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
      showError("網路連線失敗，請檢查網路後重試");
      setSaving(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "儲存費用失敗" }));
      showError(data.error || "儲存費用失敗");
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
    if (!confirm("確定要刪除此消費記錄？")) return;
    const res = await safeFetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
      method: "DELETE",
    });

    if (res.status === 0) {
      showError("網路連線失敗，請檢查網路後重試");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "刪除費用失敗" }));
      showError(data.error || "刪除費用失敗");
      return;
    }

    fetchTrip();
  };

  const deleteTrip = async () => {
    if (!trip?.permissions.canDeleteTrip) return;
    if (!confirm("確定要刪除整趟旅程？所有記錄都會消失！")) return;

    const res = await safeFetch(`/api/trips/${tripId}`, { method: "DELETE" });

    if (res.status === 0) {
      showError("網路連線失敗，請檢查網路後重試");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "刪除旅程失敗" }));
      showError(data.error || "刪除旅程失敗");
      return;
    }

    router.push("/");
  };

  const markSettlementPaid = async (settlement: SuggestedSettlement) => {
    const note = window.prompt("可選填付款備註，例如：已 LINE Pay 轉帳", "") ?? "";
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
      showError("網路連線失敗，請檢查網路後重試");
      setProcessingPayment(null);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "標記付款失敗" }));
      showError(data.error || "標記付款失敗");
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
      showError("網路連線失敗，請檢查網路後重試");
      setProcessingPayment(null);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "更新付款狀態失敗" }));
      showError(data.error || "更新付款狀態失敗");
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
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const lineHeight = 7;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    doc.setFontSize(18);
    doc.text(`${trip.name} - Settlement Summary`, margin, y);
    y += lineHeight * 2;

    doc.setFontSize(11);
    doc.text(`Total: ${formatCurrency(totalExpenses, trip.currency)}`, margin, y);
    y += lineHeight;
    doc.text(`Members: ${trip.members.length}`, margin, y);
    y += lineHeight;
    doc.text(`Expenses: ${trip.expenses.length}`, margin, y);
    y += lineHeight * 2;

    doc.setFontSize(14);
    doc.text("Pending Settlements", margin, y);
    y += lineHeight;

    doc.setFontSize(10);
    if (suggestedSettlements.length === 0) {
      doc.text("No pending settlements.", margin, y);
      y += lineHeight;
    } else {
      suggestedSettlements.forEach((s) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${s.from} -> ${s.to}: ${formatCurrency(s.amount, trip.currency)}`, margin, y);
        y += lineHeight;
      });
    }

    y += lineHeight;
    doc.setFontSize(14);
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text("Per Person Summary", margin, y);
    y += lineHeight;

    doc.setFontSize(10);
    personSettlementGroups.forEach((group) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.text(group.memberName, margin, y);
      y += lineHeight;
      doc.setFontSize(9);
      doc.text(`  To pay: ${formatCurrency(group.totalToPay, trip.currency)} | To receive: ${formatCurrency(group.totalToReceive, trip.currency)}`, margin, y);
      y += lineHeight;

      group.outgoing.forEach((item) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`    -> ${item.to}: ${formatCurrency(item.amount, trip.currency)} (${item.items.map((e) => e.description).join(", ")})`, margin, y);
        y += lineHeight;
      });
      y += 2;
    });

    y += lineHeight;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("Payment Records", margin, y);
    y += lineHeight;

    doc.setFontSize(10);
    const completedPayments = trip.payments.filter((p) => p.status === "completed");
    if (completedPayments.length === 0) {
      doc.text("No payments recorded.", margin, y);
    } else {
      completedPayments.forEach((p) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${p.fromMember.name} -> ${p.toMember.name}: ${formatCurrency(p.amount, p.currency)}${p.note ? ` (${p.note})` : ""}`, margin, y);
        y += lineHeight;
      });
    }

    doc.save(`${trip.name}-settlement.pdf`);
  };

  const exportSettlementImage = async () => {
    if (!trip) return;
    const { default: html2canvas } = await import("html2canvas");
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:white;font-family:system-ui,sans-serif;";

    const title = document.createElement("h1");
    title.style.cssText = "font-size:24px;margin-bottom:8px;color:#1a1a1a;";
    title.textContent = `${trip.coverEmoji} ${trip.name} 結算明細`;
    container.appendChild(title);

    const meta = document.createElement("p");
    meta.style.cssText = "font-size:14px;color:#666;margin-bottom:24px;";
    meta.textContent = `${trip.members.length} 人 · 總計 ${formatCurrency(totalExpenses, trip.currency)}`;
    container.appendChild(meta);

    if (suggestedSettlements.length > 0) {
      const h2 = document.createElement("h2");
      h2.style.cssText = "font-size:18px;margin-bottom:12px;color:#333;";
      h2.textContent = "待付款結算";
      container.appendChild(h2);

      suggestedSettlements.forEach((s) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:4px;background:#f9fafb;border-radius:8px;font-size:14px;";
        row.innerHTML = `<span>${s.from} → ${s.to}</span><strong>${formatCurrency(s.amount, trip.currency)}</strong>`;
        container.appendChild(row);
      });
    } else {
      const p = document.createElement("p");
      p.style.cssText = "font-size:14px;color:#22c55e;margin-bottom:16px;";
      p.textContent = "✅ 所有款項已結清";
      container.appendChild(p);
    }

    const footer = document.createElement("p");
    footer.style.cssText = "margin-top:24px;font-size:11px;color:#aaa;";
    footer.textContent = `TripSplit · ${new Date().toLocaleDateString("zh-TW")}`;
    container.appendChild(footer);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${trip.name}-settlement.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      document.body.removeChild(container);
    }
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

  const exportJSON = () => {
    if (!trip) return;
    const data = buildTripExportJSON(trip);
    downloadFile(JSON.stringify(data, null, 2), `${trip.name}-backup.json`, "application/json");
  };

  const exportCSV = () => {
    if (!trip) return;
    const csv = buildTripExportCSV(trip, customCategories);
    downloadFile(csv, `${trip.name}-expenses.csv`, "text/csv");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mb-3 text-4xl animate-bounce">✈️</div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-4 text-6xl">😵</div>
        <p className="mb-4 text-center text-gray-500">{error || "找不到此旅程"}</p>
        <div className="flex gap-3">
          <button
            onClick={fetchTrip}
            className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            重新載入
          </button>
          <Link href="/" className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-300">
            回首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Link href="/" className="shrink-0 text-gray-400 transition-colors hover:text-gray-600">
                ←
              </Link>
              <span className="shrink-0 text-2xl sm:text-3xl">{trip.coverEmoji}</span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-800 sm:text-xl">{trip.name}</h1>
                <p className="truncate text-xs text-gray-400 sm:text-sm">
                  {trip.destination && `📍 ${trip.destination} · `}
                  {formatDate(trip.startDate)}
                  {trip.endDate && ` ~ ${formatDate(trip.endDate)}`}
                </p>
                <p className="hidden text-xs text-gray-400 sm:block">
                  建立者：{trip.owner?.name || "尚未認領"} · 目前身份：{trip.currentUser.name}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowInvite((prev) => !prev)}
                className="rounded-xl bg-accent-50 px-2.5 py-1.5 text-xs text-accent-600 transition-colors hover:bg-accent-100 sm:px-3 sm:text-sm"
              >
                🔗 邀請
              </button>
              {trip.permissions.canDeleteTrip && (
                <button
                  onClick={deleteTrip}
                  className="px-2 py-1.5 text-sm text-gray-300 transition-colors hover:text-red-400"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          {showInvite && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-accent-50 p-3">
              <span className="text-sm text-accent-700">邀請碼：</span>
              <code className="rounded-lg bg-white px-3 py-1 font-mono text-lg font-bold text-accent-700">
                {trip.inviteCode}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(trip.inviteCode)}
                className="text-sm text-accent-500 hover:text-accent-700"
              >
                📋 複製
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-8">
        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
            <span>{error}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={fetchTrip}
                className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-200"
              >
                重試
              </button>
              <button onClick={() => setError("")} className="text-red-300 hover:text-red-500">
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">👥 成員 ({trip.members.length})</h3>
            {trip.permissions.canManageMembers ? (
              <span className="text-xs text-primary-500">只有建立者可以增減成員</span>
            ) : (
              <span className="text-xs text-gray-400">你目前只能查看成員名單</span>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {trip.members.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-sm text-accent-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-200 text-xs font-medium text-accent-800">
                  {member.name[0]}
                </span>
                {member.name}
                {member.userId === trip.currentUser.id && (
                  <span className="text-[10px] text-accent-500">你</span>
                )}
                {trip.permissions.canManageMembers && member.userId !== trip.owner?.id && (
                  <button
                    onClick={() => removeMember(member.id)}
                    className="ml-0.5 text-accent-300 hover:text-red-400"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {trip.permissions.canManageMembers && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                placeholder="新增成員..."
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
                onKeyDown={(e) => e.key === "Enter" && addMember()}
              />
              <button
                onClick={addMember}
                className="rounded-xl bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600"
              >
                +
              </button>
            </div>
          )}
        </div>

        <div className="no-scrollbar mt-4 flex overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
          {(
            [
              { key: "expenses", label: "💰 消費", count: trip.expenses.length },
              { key: "add", label: editingExpenseId ? "✏️ 編輯" : "➕ 記帳" },
              { key: "settle", label: "🤝 結算" },
              { key: "summary", label: "🧭 總結" },
              { key: "stats", label: "📊 統計" },
              { key: "activity", label: "📜 紀錄" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                tab === item.key ? "bg-primary-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {item.label}
              {"count" in item && item.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({item.count})</span>
              )}
            </button>
          ))}
        </div>

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
              submitLabel={editingExpenseId ? "儲存費用修改" : "儲存消費"}
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
                onToggleBreakdown={(key) =>
                  setExpandedBreakdowns((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                onMarkPaid={markSettlementPaid}
                onTogglePaymentStatus={togglePaymentStatus}
                processingPayment={processingPayment}
                onExport={exportSettlementDetails}
                onExportJSON={exportJSON}
                onExportCSV={exportCSV}
                onExportPDF={exportPDF}
                onExportImage={exportSettlementImage}
                customCategories={customCategories}
              />
              {trip.permissions.isOwner && (
                <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">💾 伺服器備份</h3>
                      <p className="mt-1 text-xs text-gray-400">建立旅程的完整備份到伺服器</p>
                    </div>
                    <button
                      onClick={triggerBackup}
                      disabled={backingUp}
                      className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:bg-primary-300"
                    >
                      {backingUp ? "備份中..." : "建立備份"}
                    </button>
                  </div>
                </div>
              )}
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
            <ActivityView
              activities={activities}
              loading={activitiesLoading}
              onRefresh={fetchActivities}
            />
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white/95 pb-safe backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between px-3 pt-2">
            <button
              onClick={() => setTab("expenses")}
              className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "expenses" ? "text-primary-600 font-medium" : "text-gray-400"}`}
            >
              <span className="text-base">📋</span>
              消費
            </button>
            <button
              onClick={() => setTab("add")}
              className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "add" ? "text-primary-600 font-medium" : "text-gray-400"}`}
            >
              <span className="text-base">✏️</span>
              記帳
            </button>
            <button
              onClick={() => setTab("settle")}
              className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "settle" ? "text-primary-600 font-medium" : "text-gray-400"}`}
            >
              <span className="text-base">💰</span>
              結算
            </button>
            <button
              onClick={() => setTab("summary")}
              className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "summary" ? "text-primary-600 font-medium" : "text-gray-400"}`}
            >
              <span className="text-base">📊</span>
              總結
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseList({
  expenses,
  allExpenses,
  currency,
  totalExpenses,
  currentUserId,
  isOwner,
  members,
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  hasActiveFilters,
  onEdit,
  onDelete,
  customCategories,
}: {
  expenses: Expense[];
  allExpenses: Expense[];
  currency: string;
  totalExpenses: number;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
  filters: ExpenseFilters;
  setFilters: React.Dispatch<React.SetStateAction<ExpenseFilters>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
  customCategories: { id: string; value: string; label: string; emoji: string }[];
}) {
  if (allExpenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📝</div>
        <p className="text-gray-400">還沒有消費記錄，快去記帳吧！</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white sm:p-5">
        <p className="text-sm opacity-80">{hasActiveFilters ? "篩選結果" : "總支出"}</p>
        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatCurrency(totalExpenses, currency)}</p>
        <p className="mt-1 text-sm opacity-60">
          {hasActiveFilters
            ? `${expenses.length} / ${allExpenses.length} 筆消費`
            : `${expenses.length} 筆消費`}
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-600"
        >
          <span className="flex items-center gap-2">
            🔍 搜尋與篩選
            {hasActiveFilters && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-600">
                篩選中
              </span>
            )}
          </span>
          <span className="text-gray-400">{showFilters ? "▴" : "▾"}</span>
        </button>

        {showFilters && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <div className="space-y-3">
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                placeholder="搜尋說明或備註..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">所有類別</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.paidById}
                  onChange={(e) => setFilters((prev) => ({ ...prev, paidById: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">所有付款人</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">起始日期</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">結束日期</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="text-xs text-primary-500 hover:text-primary-700"
                >
                  清除所有篩選條件
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {expenses.length === 0 && hasActiveFilters ? (
        <div className="py-12 text-center">
          <div className="mb-3 text-5xl">🔍</div>
          <p className="text-gray-400">沒有符合條件的消費記錄</p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-3 text-sm text-primary-500 hover:text-primary-700"
          >
            清除篩選條件
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const category = getCategoryInfo(expense.category, customCategories);
            const canManage =
              isOwner || expense.createdBy?.id === currentUserId || expense.paidBy.userId === currentUserId;

            return (
              <div key={expense.id} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                    <span className="mt-0.5 shrink-0 text-xl sm:text-2xl">{category.emoji}</span>
                    <div className="min-w-0">
                      <h4 className="truncate font-medium text-gray-800">{expense.description}</h4>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {category.label} · {formatDate(expense.date)} · {expense.paidBy.name} 付款
                      </p>
                      {expense.createdBy && (
                        <p className="mt-0.5 text-xs text-gray-400">建立者：{expense.createdBy.name}</p>
                      )}
                      {expense.note && <p className="mt-0.5 text-xs text-gray-400">💬 {expense.note}</p>}
                      {expense.settlementMode !== "normal" && (
                        <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                          {expense.settlementMode === "exclude"
                            ? "結算排除"
                            : expense.settlementMode === "partial"
                            ? `部分結算（${expense.settlementNote || "50"}%）`
                            : "線下處理 / 不納入結算"}
                          {expense.settlementMode !== "partial" && expense.settlementNote ? `：${expense.settlementNote}` : ""}
                        </p>
                      )}
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-xs text-primary-500 hover:underline"
                        >
                          📎 查看收據
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-bold text-gray-800">{formatCurrency(expense.amount, expense.currency)}</p>
                    {expense.currency !== currency && (
                      <p className="text-xs text-gray-400">
                        ≈ {formatCurrency(expense.amount * expense.exchangeRate, currency)}
                      </p>
                    )}
                    {canManage && (
                      <div className="mt-2 flex justify-end gap-3 text-xs">
                        <button
                          onClick={() => onEdit(expense)}
                          className="min-h-[28px] min-w-[40px] text-primary-500 transition-colors hover:text-primary-700"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => onDelete(expense.id)}
                          className="min-h-[28px] min-w-[40px] text-gray-300 transition-colors hover:text-red-400"
                        >
                          刪除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddExpenseForm({
  members,
  tripCurrency,
  form,
  setForm,
  customSplits,
  setCustomSplits,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
  onError,
  allCategories,
  customCategories,
  showCategoryManager,
  onToggleCategoryManager,
  newCategoryValue,
  setNewCategoryValue,
  newCategoryLabel,
  setNewCategoryLabel,
  newCategoryEmoji,
  setNewCategoryEmoji,
  onAddCustomCategory,
  onDeleteCustomCategory,
  isOwner,
}: {
  members: Member[];
  tripCurrency: string;
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  customSplits: Record<string, string>;
  setCustomSplits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel: string;
  onError: (msg: string) => void;
  allCategories: { value: string; label: string; emoji: string; isCustom: boolean }[];
  customCategories: { id: string; value: string; label: string; emoji: string }[];
  showCategoryManager: boolean;
  onToggleCategoryManager: () => void;
  newCategoryValue: string;
  setNewCategoryValue: (v: string) => void;
  newCategoryLabel: string;
  setNewCategoryLabel: (v: string) => void;
  newCategoryEmoji: string;
  setNewCategoryEmoji: (v: string) => void;
  onAddCustomCategory: () => void;
  onDeleteCustomCategory: (id: string) => void;
  isOwner: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  const fetchExchangeRate = async (from: string, to: string) => {
    if (from === to) {
      setForm((prev) => ({ ...prev, exchangeRate: "1" }));
      return;
    }

    setRateLoading(true);
    try {
      const res = await safeFetch(`/api/exchange-rate?from=${from}&to=${to}`);
      if (res.status === 0) {
        onError("匯率查詢失敗：網路連線異常，請手動輸入匯率");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, exchangeRate: String(data.rate) }));
      } else {
        onError("匯率查詢失敗，請手動輸入匯率");
      }
    } finally {
      setRateLoading(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onError("收據照片不能超過 10MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await safeFetch("/api/upload", { method: "POST", body: formData });
      if (res.status === 0) {
        onError("收據上傳失敗：網路連線異常，請稍後再試");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, receiptUrl: data.url }));
      } else {
        onError("收據上傳失敗，請稍後再試");
      }
    } finally {
      setUploading(false);
    }
  };

  if (members.length === 0) {
    return <div className="py-12 text-center text-gray-400">請先確認旅程成員資料</div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">金額 *</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">幣別</label>
            <select
              value={form.currency}
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev) => ({ ...prev, currency: value }));
                fetchExchangeRate(value, tripCurrency);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">說明 *</label>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="例：午餐拉麵"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">類別</label>
            {isOwner && (
              <button
                type="button"
                onClick={onToggleCategoryManager}
                className="text-xs text-primary-500 hover:text-primary-700"
              >
                {showCategoryManager ? "收合" : "⚙️ 管理類別"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, category: category.value }))}
                className={`rounded-xl px-3 py-2 text-sm transition-all ${
                  form.category === category.value
                    ? "bg-primary-500 text-white"
                    : category.isCustom
                    ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {category.emoji} {category.label}
              </button>
            ))}
          </div>
          {showCategoryManager && (
            <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50/50 p-3">
              <h4 className="mb-2 text-sm font-medium text-purple-700">自訂類別管理</h4>
              {customCategories.length > 0 && (
                <div className="mb-3 space-y-1">
                  {customCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span className="text-sm text-gray-700">{cat.emoji} {cat.label} <span className="text-xs text-gray-400">({cat.value})</span></span>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomCategory(cat.id)}
                        className="text-xs text-gray-300 hover:text-red-400"
                      >
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryEmoji}
                  onChange={(e) => setNewCategoryEmoji(e.target.value)}
                  className="w-12 rounded-lg border border-purple-200 px-2 py-1.5 text-center text-sm"
                  placeholder="📝"
                  maxLength={4}
                />
                <input
                  type="text"
                  value={newCategoryValue}
                  onChange={(e) => setNewCategoryValue(e.target.value)}
                  className="w-24 rounded-lg border border-purple-200 px-2 py-1.5 text-sm"
                  placeholder="代碼"
                />
                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-purple-200 px-2 py-1.5 text-sm"
                  placeholder="顯示名稱"
                />
                <button
                  type="button"
                  onClick={onAddCustomCategory}
                  className="rounded-lg bg-purple-500 px-3 py-1.5 text-sm text-white hover:bg-purple-600"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">日期 *</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">誰付的 *</label>
            <select
              required
              value={form.paidById}
              onChange={(e) => setForm((prev) => ({ ...prev, paidById: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">備註</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="選填..."
          />
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">結算特殊處理</label>
          <select
            value={form.settlementMode}
            onChange={(e) => setForm((prev) => ({ ...prev, settlementMode: e.target.value }))}
            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="normal">正常納入結算</option>
            <option value="exclude">保留記帳，但不納入結算</option>
            <option value="external">已線下處理 / 私人支出</option>
            <option value="partial">部分納入結算（自訂比例）</option>
          </select>
          {form.settlementMode !== "normal" && (
            <>
              {form.settlementMode === "partial" && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs text-amber-700">納入結算的比例 (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={form.settlementNote?.match(/^\d+$/) ? form.settlementNote : "50"}
                    onChange={(e) => setForm((prev) => ({ ...prev, settlementNote: e.target.value }))}
                    className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="50"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-amber-600">
                    此筆費用將有 {form.settlementNote?.match(/^\d+$/) ? form.settlementNote : "50"}% 納入結算
                  </p>
                </div>
              )}
              {form.settlementMode !== "partial" && (
                <input
                  type="text"
                  value={form.settlementNote}
                  onChange={(e) => setForm((prev) => ({ ...prev, settlementNote: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="例如：這筆是私人購物 / 已現金處理"
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <label className="mb-2 block text-sm font-medium text-gray-600">分帳方式</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {SPLIT_TYPES.map((splitType) => (
            <button
              key={splitType.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, splitType: splitType.value }))}
              className={`rounded-xl px-4 py-2 text-sm transition-all ${
                form.splitType === splitType.value
                  ? "bg-accent-500 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {splitType.label}
            </button>
          ))}
        </div>

        {(form.splitType === "exact" || form.splitType === "percentage") && (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <span className="w-20 truncate text-sm text-gray-600">{member.name}</span>
                <input
                  type="number"
                  step="0.01"
                  value={customSplits[member.id] || ""}
                  onChange={(e) =>
                    setCustomSplits((prev) => ({ ...prev, [member.id]: e.target.value }))
                  }
                  placeholder={form.splitType === "percentage" ? "%" : "金額"}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
                  inputMode="decimal"
                />
                {form.splitType === "percentage" && <span className="text-sm text-gray-400">%</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {form.currency !== tripCurrency && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <label className="mb-2 block text-sm font-medium text-gray-600">
            💱 匯率 ({form.currency} → {tripCurrency})
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.0001"
              value={form.exchangeRate}
              onChange={(e) => setForm((prev) => ({ ...prev, exchangeRate: e.target.value }))}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
              inputMode="decimal"
            />
            {rateLoading && <span className="text-sm text-gray-400">查詢中...</span>}
            {form.amount && (
              <span className="text-sm text-gray-500">
                ≈ {formatCurrency(parseFloat(form.amount) * parseFloat(form.exchangeRate || "1"), tripCurrency)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <label className="mb-2 block text-sm font-medium text-gray-600">📸 收據照片</label>
        {form.receiptUrl ? (
          <div className="relative">
            <img src={form.receiptUrl} alt="收據" className="max-h-48 w-full rounded-xl object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, receiptUrl: "" }))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white hover:bg-black/70"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 transition-colors hover:border-primary-300 hover:bg-primary-50/30 active:bg-primary-50/50">
            <span className="mb-2 text-3xl">📷</span>
            <span className="text-sm text-gray-400">{uploading ? "上傳中..." : "點擊上傳收據照片"}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-primary-500 py-3.5 font-semibold text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300"
        >
          {saving ? "儲存中..." : `💾 ${submitLabel}`}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-gray-200 px-5 py-3.5 font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}

function SettlementView({
  currency,
  totalExpenses,
  members,
  expenses,
  payments,
  settlements,
  pairwiseBreakdowns,
  personSettlementGroups,
  expandedBreakdowns,
  onToggleBreakdown,
  onMarkPaid,
  onTogglePaymentStatus,
  processingPayment,
  onExport,
  onExportJSON,
  onExportCSV,
  onExportPDF,
  onExportImage,
  customCategories,
}: {
  currency: string;
  totalExpenses: number;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  settlements: SuggestedSettlement[];
  pairwiseBreakdowns: PairwiseBreakdown[];
  personSettlementGroups: ReturnType<typeof calculatePersonSettlementGroups>;
  expandedBreakdowns: Record<string, boolean>;
  onToggleBreakdown: (key: string) => void;
  onMarkPaid: (settlement: SuggestedSettlement) => void;
  onTogglePaymentStatus: (paymentId: string, status: "completed" | "cancelled") => void;
  processingPayment: string | null;
  onExport: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onExportImage: () => void;
  customCategories: { id: string; value: string; label: string; emoji: string }[];
}) {
  const perPerson = members.length > 0 ? totalExpenses / members.length : 0;
  const specialExpenses = expenses.filter((expense) => expense.settlementMode !== "normal");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-accent-500 to-accent-600 p-4 text-white sm:p-5">
        <p className="text-sm opacity-80">人均花費</p>
        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatCurrency(perPerson, currency)}</p>
        <p className="mt-1 text-sm opacity-60">
          共 {members.length} 人 · 總計 {formatCurrency(totalExpenses, currency)}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">💸 待付款結算</h3>
            <p className="mt-1 text-xs text-gray-400">標記已付款後，系統會自動把這筆款項從待結算結果中扣掉。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onExport}
              className="rounded-xl border border-primary-200 px-3 py-2 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 sm:text-sm"
            >
              📄 結算明細
            </button>
            <button
              onClick={onExportPDF}
              className="rounded-xl border border-purple-200 px-3 py-2 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 sm:text-sm"
            >
              📑 PDF
            </button>
            <button
              onClick={onExportImage}
              className="rounded-xl border border-pink-200 px-3 py-2 text-xs font-medium text-pink-600 transition-colors hover:bg-pink-50 sm:text-sm"
            >
              🖼️ 圖片
            </button>
            <button
              onClick={onExportJSON}
              className="rounded-xl border border-accent-200 px-3 py-2 text-xs font-medium text-accent-600 transition-colors hover:bg-accent-50 sm:text-sm"
            >
              💾 JSON 備份
            </button>
            <button
              onClick={onExportCSV}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:text-sm"
            >
              📊 CSV 匯出
            </button>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mb-3 text-5xl">✅</div>
            <p className="text-gray-500">目前沒有待處理的結算。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((settlement) => {
              const paymentKey = `${settlement.fromMemberId}:${settlement.toMemberId}`;
              const pairwise = pairwiseBreakdowns.find(
                (item) =>
                  item.fromMemberId === settlement.fromMemberId && item.toMemberId === settlement.toMemberId
              );

              return (
                <div key={paymentKey} className="rounded-xl border border-gray-100 px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {settlement.from} → {settlement.to}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {pairwise ? `${pairwise.items.length} 筆原始品項可對照` : "這筆是最佳化後的結算建議"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-600">
                        {formatCurrency(settlement.amount, currency)}
                      </span>
                      <button
                        onClick={() => onMarkPaid(settlement)}
                        disabled={processingPayment === paymentKey}
                        className="rounded-xl bg-primary-500 px-3 py-2 text-sm text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300"
                      >
                        {processingPayment === paymentKey ? "處理中..." : "標記已付款"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-1 text-sm font-medium text-gray-500">🧾 依付款關係拆分的品項明細</h3>
        <p className="mb-4 text-xs text-gray-400">用原始消費資料對照每一筆品項，核對付款原因時最直接。</p>
        <div className="space-y-4">
          {pairwiseBreakdowns.map((breakdown) => {
            const key = `${breakdown.fromMemberId}:${breakdown.toMemberId}`;
            const isExpanded = expandedBreakdowns[key] ?? false;

            return (
              <div key={key} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => onToggleBreakdown(key)}
                  className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="font-medium">{breakdown.from}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-medium">{breakdown.to}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {breakdown.items.length} 筆品項 {isExpanded ? "· 點擊收合" : "· 點擊展開"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <p className="text-sm font-semibold text-primary-600">
                      合計 {formatCurrency(breakdown.amount, currency)}
                    </p>
                    <span className="text-sm text-gray-400" aria-hidden="true">
                      {isExpanded ? "▴" : "▾"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {breakdown.items.map((item) => {
                      const category = getCategoryInfo(item.category, customCategories);

                      return (
                        <div
                          key={`${key}-${item.expenseId}`}
                          className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {category.emoji} {item.description}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {category.label} · {formatDate(item.date)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-gray-700">
                              {formatCurrency(item.amount, currency)}
                            </p>
                            {item.originalCurrency !== currency && (
                              <p className="text-xs text-gray-400">
                                原始分攤 {formatCurrency(item.originalAmount, item.originalCurrency)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {specialExpenses.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="mb-1 text-sm font-medium text-gray-500">⚠️ 不納入自動結算的費用</h3>
          <p className="mb-4 text-xs text-gray-400">
            這些費用仍會保留在記帳與統計中，但不會參與自動結算建議。
          </p>
          <div className="space-y-2">
            {specialExpenses.map((expense) => (
              <div key={expense.id} className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{expense.description}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {expense.paidBy.name} · {expense.settlementMode === "exclude" ? "保留記帳，不納入結算" : expense.settlementMode === "partial" ? `部分結算（${expense.settlementNote || "50"}%）` : "線下處理 / 私人支出"}
                    </p>
                    {expense.settlementNote && (
                      <p className="mt-1 text-xs text-amber-700">備註：{expense.settlementNote}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-amber-700">
                    {formatCurrency(expense.amount * expense.exchangeRate, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-1 text-sm font-medium text-gray-500">👤 依人查看結算明細</h3>
        <p className="mb-4 text-xs text-gray-400">每個人都可以從自己的角度看待付、待收與對應品項。</p>
        <div className="space-y-4">
          {personSettlementGroups.map((group) => (
            <div key={group.memberId} className="rounded-2xl border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-medium text-gray-800">{group.memberName}</h4>
                  <p className="mt-1 text-xs text-gray-400">
                    待付 {formatCurrency(group.totalToPay, currency)} · 待收 {formatCurrency(group.totalToReceive, currency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-red-50/60 p-3">
                  <h5 className="text-sm font-medium text-red-600">待付款項</h5>
                  {group.outgoing.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">沒有待付款項</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {group.outgoing.map((item) => (
                        <div key={`${group.memberId}-${item.toMemberId}`} className="rounded-lg bg-white px-3 py-2">
                          <p className="text-sm text-gray-700">付給 {item.to}</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatCurrency(item.amount, currency)}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {item.items.map((expense) => expense.description).join("、")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-green-50/60 p-3">
                  <h5 className="text-sm font-medium text-green-600">待收款項</h5>
                  {group.incoming.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">沒有待收款項</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {group.incoming.map((item) => (
                        <div key={`${group.memberId}-${item.fromMemberId}`} className="rounded-lg bg-white px-3 py-2">
                          <p className="text-sm text-gray-700">向 {item.from} 收款</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatCurrency(item.amount, currency)}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {item.items.map((expense) => expense.description).join("、")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-500">✅ 已付款紀錄</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400">目前尚未標記任何付款完成。</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {payment.fromMember.name} → {payment.toMember.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(payment.settledAt)} · {payment.settledBy.name} 標記 · {payment.status === "completed" ? "已完成" : "已取消"}
                  </p>
                  {payment.note && <p className="mt-1 text-xs text-gray-400">備註：{payment.note}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-700">{formatCurrency(payment.amount, payment.currency)}</span>
                  <button
                    onClick={() =>
                      onTogglePaymentStatus(
                        payment.id,
                        payment.status === "completed" ? "cancelled" : "completed"
                      )
                    }
                    disabled={processingPayment === payment.id}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 active:bg-gray-50 disabled:text-gray-300"
                  >
                    {processingPayment === payment.id
                      ? "處理中..."
                      : payment.status === "completed"
                      ? "撤銷"
                      : "恢復"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-500">📋 個人花費明細</h3>
        <div className="space-y-2">
          {members.map((member) => {
            const paid = expenses
              .filter((expense) => expense.paidBy.id === member.id)
              .reduce((sum, expense) => sum + expense.amount * expense.exchangeRate, 0);
            const owed = expenses.reduce((sum, expense) => {
              const split = expense.splits.find((item) => item.member.id === member.id);
              return sum + (split ? split.amount * expense.exchangeRate : 0);
            }, 0);
            const balance = paid - owed;

            return (
              <div key={member.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-medium text-accent-700">
                    {member.name[0]}
                  </span>
                  <span className="text-gray-700">{member.name}</span>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-400 sm:text-sm">
                    付 {formatCurrency(paid, currency)} / 分攤 {formatCurrency(owed, currency)}
                  </p>
                  <p
                    className={`text-xs font-medium sm:text-sm ${
                      balance > 0 ? "text-green-600" : balance < 0 ? "text-red-500" : "text-gray-400"
                    }`}
                  >
                    {balance > 0
                      ? `可收回 ${formatCurrency(balance, currency)}`
                      : balance < 0
                      ? `需付出 ${formatCurrency(-balance, currency)}`
                      : "已平帳"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TripSummaryView({
  trip,
  totalExpenses,
  settlements,
  customCategories,
}: {
  trip: Trip;
  totalExpenses: number;
  settlements: SuggestedSettlement[];
  customCategories: { id: string; value: string; label: string; emoji: string }[];
}) {
  const settleableExpenses = trip.expenses.filter((expense) => expense.settlementMode === "normal");
  const specialExpenses = trip.expenses.filter((expense) => expense.settlementMode !== "normal");

  const payerTotals = trip.members.map((member) => ({
    member,
    amount: trip.expenses
      .filter((expense) => expense.paidBy.id === member.id)
      .reduce((sum, expense) => sum + expense.amount * expense.exchangeRate, 0),
  }));

  const topPayer = [...payerTotals].sort((a, b) => b.amount - a.amount)[0];
  const largestExpense = [...trip.expenses].sort(
    (a, b) => b.amount * b.exchangeRate - a.amount * a.exchangeRate
  )[0];

  const topCategory = Object.entries(
    trip.expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount * expense.exchangeRate;
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a)[0];

  const busiestDay = Object.entries(
    trip.expenses.reduce<Record<string, number>>((acc, expense) => {
      const key = formatDateForInput(expense.date);
      acc[key] = (acc[key] || 0) + expense.amount * expense.exchangeRate;
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="總支出" value={formatCurrency(totalExpenses, trip.currency)} subLabel={`${trip.expenses.length} 筆費用`} />
        <SummaryCard label="待結算筆數" value={`${settlements.length} 筆`} subLabel="尚未完成的建議轉帳" />
        <SummaryCard label="納入結算" value={formatCurrency(settleableExpenses.reduce((sum, e) => sum + e.amount * e.exchangeRate, 0), trip.currency)} subLabel={`${settleableExpenses.length} 筆可結算費用`} />
        <SummaryCard label="特殊處理費用" value={`${specialExpenses.length} 筆`} subLabel="已排除或線下處理" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-500">🏆 旅程亮點</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>支付最多：<span className="font-semibold">{topPayer?.member.name || "-"}</span>（{formatCurrency(topPayer?.amount || 0, trip.currency)}）</p>
            <p>最大單筆：<span className="font-semibold">{largestExpense?.description || "-"}</span>{largestExpense ? `（${formatCurrency(largestExpense.amount * largestExpense.exchangeRate, trip.currency)}）` : ""}</p>
            <p>最高支出日：<span className="font-semibold">{busiestDay?.[0] || "-"}</span>{busiestDay ? `（${formatCurrency(busiestDay[1], trip.currency)}）` : ""}</p>
            <p>最大類別：<span className="font-semibold">{topCategory ? `${getCategoryInfo(topCategory[0], customCategories).emoji} ${getCategoryInfo(topCategory[0], customCategories).label}` : "-"}</span>{topCategory ? `（${formatCurrency(topCategory[1], trip.currency)}）` : ""}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-500">📌 後續提醒</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>目前還有 <span className="font-semibold">{settlements.length}</span> 筆待處理結算。</p>
            <p>若要備份旅程，可到結算頁匯出 JSON；如需還原，可回首頁匯入備份。</p>
            <p>若有 <span className="font-semibold">{specialExpenses.length}</span> 筆特殊處理費用，請在實際付款前再次確認是否仍需排除。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subLabel }: { label: string; value: string; subLabel: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-800">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subLabel}</p>
    </div>
  );
}

function StatsView({ expenses, currency, customCategories }: { expenses: Expense[]; currency: string; customCategories: { id: string; value: string; label: string; emoji: string }[] }) {
  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📊</div>
        <p className="text-gray-400">沒有消費數據可以統計</p>
      </div>
    );
  }

  const categoryTotals: Record<string, number> = {};
  const dailyTotals: Record<string, number> = {};

  expenses.forEach((expense) => {
    const amountInBase = expense.amount * expense.exchangeRate;
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + amountInBase;
    const dateKey = new Date(expense.date).toISOString().split("T")[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + amountInBase;
  });

  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const total = sortedCategories.reduce((sum, [, value]) => sum + value, 0);
  const colors = [
    "bg-primary-500",
    "bg-accent-500",
    "bg-sand-400",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-teal-500",
  ];

  const sortedDays = Object.entries(dailyTotals).sort(([a], [b]) => a.localeCompare(b));
  const maxDaily = Math.max(...sortedDays.map(([, value]) => value));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-500">🥧 消費類別分佈</h3>
        <div className="mb-4 flex h-4 overflow-hidden rounded-full">
          {sortedCategories.map(([category, amount], index) => (
            <div
              key={category}
              className={`${colors[index % colors.length]} transition-all`}
              style={{ width: `${(amount / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="space-y-2">
          {sortedCategories.map(([category, amount], index) => {
            const info = getCategoryInfo(category, customCategories);
            const percentage = ((amount / total) * 100).toFixed(1);
            return (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${colors[index % colors.length]}`} />
                  <span className="text-sm text-gray-600">
                    {info.emoji} {info.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(amount, currency)}</span>
                  <span className="ml-2 text-xs text-gray-400">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-500">📈 每日花費趨勢</h3>
        <div className="space-y-2">
          {sortedDays.map(([day, amount]) => (
            <div key={day} className="flex items-center gap-2 sm:gap-3">
              <span className="w-14 shrink-0 text-xs text-gray-400 sm:w-20">{day.slice(5)}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-50">
                <div
                  className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-primary-400 to-primary-500 pr-2 transition-all"
                  style={{ width: `${Math.max((amount / maxDaily) * 100, 10)}%` }}
                >
                  <span className="text-xs font-medium text-white">{formatCurrency(amount, currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityView({
  activities,
  loading,
  onRefresh,
}: {
  activities: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <div className="mb-3 text-4xl animate-bounce">📜</div>
        <p>載入操作紀錄...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📜</div>
        <p className="text-gray-400">目前還沒有操作紀錄</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">最近操作紀錄</h3>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
        >
          🔄 重新整理
        </button>
      </div>
      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4"
          >
            <span className="mt-0.5 shrink-0 text-xl">{getActivityEmoji(activity.action)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{activity.user?.name || "系統"}</span>
                {" "}
                {getActivityLabel(activity.action)}
              </p>
              {activity.details && (
                <p className="mt-0.5 truncate text-xs text-gray-400">{activity.details}</p>
              )}
              <p className="mt-1 text-xs text-gray-300">
                {new Date(activity.createdAt).toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
