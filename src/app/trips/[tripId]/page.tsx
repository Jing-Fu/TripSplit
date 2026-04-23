"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EXPENSE_CATEGORIES, CURRENCIES, SPLIT_TYPES } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateForInput } from "@/lib/utils";

type Member = { id: string; name: string };
type Split = { id: string; amount: number; member: Member };
type Expense = {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  category: string;
  description: string;
  note: string | null;
  date: string;
  receiptUrl: string | null;
  splitType: string;
  paidBy: Member;
  splits: Split[];
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
  members: Member[];
  expenses: Expense[];
};

type Settlement = { from: string; to: string; amount: number };

type SettlementBreakdownItem = {
  expenseId: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  originalAmount: number;
  originalCurrency: string;
};

type PairwiseBreakdown = {
  from: string;
  to: string;
  amount: number;
  items: SettlementBreakdownItem[];
};

type Tab = "expenses" | "add" | "settle" | "stats";

const defaultExpenseForm = {
  amount: "",
  currency: "TWD",
  category: "food",
  description: "",
  note: "",
  date: formatDateForInput(new Date()),
  paidById: "",
  splitType: "equal",
  receiptUrl: "",
  exchangeRate: "1",
};

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("expenses");
  const [newMember, setNewMember] = useState("");
  const [expenseForm, setExpenseForm] = useState(defaultExpenseForm);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const fetchTrip = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setTrip(data);
      setExpenseForm((prev) => {
        if (!prev.paidById && data.members.length > 0) {
          return { ...prev, paidById: data.members[0].id, currency: data.currency };
        }
        return prev;
      });
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const addMember = async () => {
    if (!newMember.trim()) return;
    await fetch(`/api/trips/${tripId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMember.trim() }),
    });
    setNewMember("");
    fetchTrip();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("確定要移除此成員？")) return;
    await fetch(`/api/trips/${tripId}/members?memberId=${memberId}`, {
      method: "DELETE",
    });
    fetchTrip();
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setSaving(true);

    let splits: { memberId: string; amount: number }[] = [];
    const amt = parseFloat(expenseForm.amount);

    if (expenseForm.splitType === "equal") {
      const perPerson = amt / trip.members.length;
      splits = trip.members.map((m) => ({
        memberId: m.id,
        amount: Math.round(perPerson * 100) / 100,
      }));
    } else if (expenseForm.splitType === "payer_only") {
      splits = [{ memberId: expenseForm.paidById, amount: amt }];
    } else {
      splits = trip.members
        .filter((m) => customSplits[m.id] && parseFloat(customSplits[m.id]) > 0)
        .map((m) => ({
          memberId: m.id,
          amount: parseFloat(customSplits[m.id]),
        }));
    }

    await fetch(`/api/trips/${tripId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...expenseForm,
        exchangeRate: expenseForm.exchangeRate || "1",
        splits,
      }),
    });

    setExpenseForm({ ...defaultExpenseForm, paidById: trip.members[0]?.id || "", currency: trip.currency });
    setCustomSplits({});
    setSaving(false);
    setTab("expenses");
    fetchTrip();
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("確定要刪除此消費記錄？")) return;
    await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    fetchTrip();
  };

  const deleteTrip = async () => {
    if (!confirm("確定要刪除整趟旅程？所有記錄都會消失！")) return;
    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    router.push("/");
  };

  const calculateSettlement = (): Settlement[] => {
    if (!trip) return [];

    const balances: Record<string, number> = {};
    trip.members.forEach((m) => {
      balances[m.id] = 0;
    });

    trip.expenses.forEach((expense) => {
      const amountInBase = expense.amount * expense.exchangeRate;
      balances[expense.paidBy.id] = (balances[expense.paidBy.id] || 0) + amountInBase;
      expense.splits.forEach((split) => {
        const splitInBase = split.amount * expense.exchangeRate;
        balances[split.member.id] = (balances[split.member.id] || 0) - splitInBase;
      });
    });

    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    trip.members.forEach((m) => {
      const balance = balances[m.id] || 0;
      if (balance < -0.01) {
        debtors.push({ id: m.id, name: m.name, amount: -balance });
      } else if (balance > 0.01) {
        creditors.push({ id: m.id, name: m.name, amount: balance });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];
    let di = 0,
      ci = 0;

    while (di < debtors.length && ci < creditors.length) {
      const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
      if (transfer > 0.01) {
        settlements.push({
          from: debtors[di].name,
          to: creditors[ci].name,
          amount: Math.round(transfer * 100) / 100,
        });
      }
      debtors[di].amount -= transfer;
      creditors[ci].amount -= transfer;
      if (debtors[di].amount < 0.01) di++;
      if (creditors[ci].amount < 0.01) ci++;
    }

    return settlements;
  };

  const calculatePairwiseBreakdown = (): PairwiseBreakdown[] => {
    if (!trip) return [];

    const breakdownMap = new Map<string, PairwiseBreakdown>();

    trip.expenses.forEach((expense) => {
      expense.splits.forEach((split) => {
        if (split.member.id === expense.paidBy.id) {
          return;
        }

        const amount = Math.round(split.amount * expense.exchangeRate * 100) / 100;

        if (amount <= 0) {
          return;
        }

        const key = `${split.member.id}:${expense.paidBy.id}`;
        const existing = breakdownMap.get(key);

        const item: SettlementBreakdownItem = {
          expenseId: expense.id,
          description: expense.description,
          category: expense.category,
          date: expense.date,
          amount,
          originalAmount: split.amount,
          originalCurrency: expense.currency,
        };

        if (existing) {
          existing.amount = Math.round((existing.amount + amount) * 100) / 100;
          existing.items.push(item);
          return;
        }

        breakdownMap.set(key, {
          from: split.member.name,
          to: expense.paidBy.name,
          amount,
          items: [item],
        });
      });
    });

    return Array.from(breakdownMap.values())
      .map((entry) => ({
        ...entry,
        items: entry.items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  const getCategoryInfo = (value: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === value) ?? {
      value: "other",
      label: "其他",
      emoji: "📝",
    };

  const totalExpenses = trip?.expenses.reduce(
    (sum, e) => sum + e.amount * e.exchangeRate,
    0
  ) ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        載入中...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">😵</div>
        <p className="text-gray-500 mb-4">找不到此旅程</p>
        <Link href="/" className="text-primary-500 hover:underline">
          回首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-primary-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ←
              </Link>
              <span className="text-3xl">{trip.coverEmoji}</span>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {trip.name}
                </h1>
                <p className="text-sm text-gray-400">
                  {trip.destination && `📍 ${trip.destination} · `}
                  {formatDate(trip.startDate)}
                  {trip.endDate && ` ~ ${formatDate(trip.endDate)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="text-sm bg-accent-50 text-accent-600 px-3 py-1.5 rounded-xl hover:bg-accent-100 transition-colors"
              >
                🔗 邀請
              </button>
              <button
                onClick={deleteTrip}
                className="text-sm text-gray-300 hover:text-red-400 px-2 py-1.5 transition-colors"
              >
                🗑️
              </button>
            </div>
          </div>

          {showInvite && (
            <div className="mt-3 bg-accent-50 rounded-xl p-3 flex items-center gap-3">
              <span className="text-sm text-accent-700">邀請碼：</span>
              <code className="bg-white px-3 py-1 rounded-lg font-mono text-lg font-bold text-accent-700">
                {trip.inviteCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(trip.inviteCode);
                }}
                className="text-sm text-accent-500 hover:text-accent-700"
              >
                📋 複製
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-2xl mt-4 p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">👥 成員 ({trip.members.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {trip.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 bg-accent-50 text-accent-700 px-3 py-1.5 rounded-full text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-accent-200 text-accent-800 text-xs flex items-center justify-center font-medium">
                  {m.name[0]}
                </span>
                {m.name}
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-accent-300 hover:text-red-400 ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="新增成員..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
              onKeyDown={(e) => e.key === "Enter" && addMember()}
            />
            <button
              onClick={addMember}
              className="text-sm bg-accent-500 text-white px-4 py-2 rounded-xl hover:bg-accent-600 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl mt-4 p-1 shadow-sm border border-gray-100 flex">
          {(
            [
              { key: "expenses", label: "💰 消費", count: trip.expenses.length },
              { key: "add", label: "➕ 記帳" },
              { key: "settle", label: "🤝 結算" },
              { key: "stats", label: "📊 統計" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {"count" in t && t.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 pb-8">
          {tab === "expenses" && (
            <ExpenseList
              expenses={trip.expenses}
              currency={trip.currency}
              totalExpenses={totalExpenses}
              getCategoryInfo={getCategoryInfo}
              onDelete={deleteExpense}
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
              onSubmit={addExpense}
            />
          )}
          {tab === "settle" && (
            <SettlementView
              settlements={calculateSettlement()}
              pairwiseBreakdowns={calculatePairwiseBreakdown()}
              currency={trip.currency}
              totalExpenses={totalExpenses}
              members={trip.members}
              expenses={trip.expenses}
              getCategoryInfo={getCategoryInfo}
            />
          )}
          {tab === "stats" && (
            <StatsView
              expenses={trip.expenses}
              currency={trip.currency}
              getCategoryInfo={getCategoryInfo}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ExpenseList({
  expenses,
  currency,
  totalExpenses,
  getCategoryInfo,
  onDelete,
}: {
  expenses: Expense[];
  currency: string;
  totalExpenses: number;
  getCategoryInfo: (v: string) => { label: string; emoji: string };
  onDelete: (id: string) => void;
}) {
  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📝</div>
        <p className="text-gray-400">還沒有消費記錄，快去記帳吧！</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-5 text-white mb-4">
        <p className="text-sm opacity-80">總支出</p>
        <p className="text-3xl font-bold mt-1">
          {formatCurrency(totalExpenses, currency)}
        </p>
        <p className="text-sm opacity-60 mt-1">{expenses.length} 筆消費</p>
      </div>

      <div className="space-y-3">
        {expenses.map((expense) => {
          const cat = getCategoryInfo(expense.category);
          return (
            <div
              key={expense.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{cat.emoji}</span>
                  <div>
                    <h4 className="font-medium text-gray-800">
                      {expense.description}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cat.label} · {formatDate(expense.date)} ·{" "}
                      {expense.paidBy.name} 付款
                    </p>
                    {expense.note && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        💬 {expense.note}
                      </p>
                    )}
                    {expense.receiptUrl && (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-500 hover:underline mt-0.5 inline-block"
                      >
                        📎 查看收據
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">
                    {formatCurrency(expense.amount, expense.currency)}
                  </p>
                  {expense.currency !== currency && (
                    <p className="text-xs text-gray-400">
                      ≈ {formatCurrency(expense.amount * expense.exchangeRate, currency)}
                    </p>
                  )}
                  <button
                    onClick={() => onDelete(expense.id)}
                    className="text-xs text-gray-300 hover:text-red-400 mt-1 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
}: {
  members: Member[];
  tripCurrency: string;
  form: typeof defaultExpenseForm;
  setForm: React.Dispatch<React.SetStateAction<typeof defaultExpenseForm>>;
  customSplits: Record<string, string>;
  setCustomSplits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
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
      const res = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, exchangeRate: String(data.rate) }));
      }
    } finally {
      setRateLoading(false);
    }
  };

  const handleCurrencyChange = (currency: string) => {
    setForm((prev) => ({ ...prev, currency }));
    fetchExchangeRate(currency, tripCurrency);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setForm((prev) => ({ ...prev, receiptUrl: url }));
      }
    } finally {
      setUploading(false);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">👥</div>
        <p className="text-gray-400">請先新增旅伴成員才能記帳</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              金額 *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              幣別
            </label>
            <select
              value={form.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            說明 *
          </label>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="例：午餐拉麵"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            類別
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, category: cat.value }))
                }
                className={`px-3 py-1.5 rounded-xl text-sm transition-all ${
                  form.category === cat.value
                    ? "bg-primary-500 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              日期 *
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              誰付的 *
            </label>
            <select
              required
              value={form.paidById}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paidById: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            備註
          </label>
          <input
            type="text"
            value={form.note}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="選填..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-600 mb-2">
          分帳方式
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {SPLIT_TYPES.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() =>
                setForm((prev) => ({ ...prev, splitType: st.value }))
              }
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                form.splitType === st.value
                  ? "bg-accent-500 text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {(form.splitType === "exact" || form.splitType === "percentage") && (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-20 truncate">
                  {m.name}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={customSplits[m.id] || ""}
                  onChange={(e) =>
                    setCustomSplits((prev) => ({
                      ...prev,
                      [m.id]: e.target.value,
                    }))
                  }
                  placeholder={form.splitType === "percentage" ? "%" : "金額"}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
                {form.splitType === "percentage" && (
                  <span className="text-sm text-gray-400">%</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {form.currency !== tripCurrency && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            💱 匯率 ({form.currency} → {tripCurrency})
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.0001"
              value={form.exchangeRate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, exchangeRate: e.target.value }))
              }
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {rateLoading && (
              <span className="text-sm text-gray-400">查詢中...</span>
            )}
            {form.amount && (
              <span className="text-sm text-gray-500">
                ≈ {formatCurrency(
                  parseFloat(form.amount) * parseFloat(form.exchangeRate || "1"),
                  tripCurrency
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-600 mb-2">
          📸 收據照片
        </label>
        {form.receiptUrl ? (
          <div className="relative">
            <img
              src={form.receiptUrl}
              alt="收據"
              className="w-full max-h-48 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, receiptUrl: "" }))}
              className="absolute top-2 right-2 bg-black/50 text-white w-7 h-7 rounded-full text-sm hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-sm text-gray-400">
              {uploading ? "上傳中..." : "點擊上傳收據照片"}
            </span>
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

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white py-3 rounded-2xl font-semibold transition-colors shadow-md shadow-primary-200"
      >
        {saving ? "儲存中..." : "💾 儲存消費"}
      </button>
    </form>
  );
}

function SettlementView({
  settlements,
  pairwiseBreakdowns,
  currency,
  totalExpenses,
  members,
  expenses,
  getCategoryInfo,
}: {
  settlements: Settlement[];
  pairwiseBreakdowns: PairwiseBreakdown[];
  currency: string;
  totalExpenses: number;
  members: Member[];
  expenses: Expense[];
  getCategoryInfo: (v: string) => { label: string; emoji: string };
}) {
  const perPerson = members.length > 0 ? totalExpenses / members.length : 0;
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});

  const toggleBreakdown = (key: string) => {
    setExpandedBreakdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-accent-500 to-accent-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">人均花費</p>
        <p className="text-3xl font-bold mt-1">
          {formatCurrency(perPerson, currency)}
        </p>
        <p className="text-sm opacity-60 mt-1">
          共 {members.length} 人 · 總計 {formatCurrency(totalExpenses, currency)}
        </p>
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-500">帳已平，不需要結算！</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            💸 最佳結算方案
          </h3>
          <div className="space-y-3">
            {settlements.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 text-xs flex items-center justify-center font-medium">
                    {s.from[0]}
                  </span>
                  <span className="text-gray-600">{s.from}</span>
                  <span className="text-gray-300 mx-1">→</span>
                  <span className="w-8 h-8 rounded-full bg-green-50 text-green-600 text-xs flex items-center justify-center font-medium">
                    {s.to[0]}
                  </span>
                  <span className="text-gray-600">{s.to}</span>
                </div>
                <span className="font-bold text-primary-600">
                  {formatCurrency(s.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pairwiseBreakdowns.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            🧾 按品項拆分的付款明細
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            這裡保留原始消費的付款對象與品項，方便核對每一筆錢是為了什麼支出。
          </p>
          <div className="space-y-4">
            {pairwiseBreakdowns.map((breakdown) => {
              const breakdownKey = `${breakdown.from}-${breakdown.to}`;
              const isExpanded = expandedBreakdowns[breakdownKey] ?? false;

              return (
                <div
                  key={breakdownKey}
                  className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleBreakdown(breakdownKey)}
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
                        const category = getCategoryInfo(item.category);

                        return (
                          <div
                            key={`${breakdown.from}-${breakdown.to}-${item.expenseId}`}
                            className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {category.emoji} {item.description}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {category.label} · {formatDate(item.date)}
                              </p>
                            </div>
                            <div className="text-right">
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
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          📋 個人花費明細
        </h3>
        <div className="space-y-2">
          {members.map((m) => {
            const paid = expenses
              .filter((e) => e.paidBy.id === m.id)
              .reduce((sum, e) => sum + e.amount * e.exchangeRate, 0);
            const owed = expenses.reduce((sum, e) => {
              const split = e.splits.find((s) => s.member.id === m.id);
              return sum + (split ? split.amount * e.exchangeRate : 0);
            }, 0);
            const balance = paid - owed;

            return (
              <div
                key={m.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-accent-100 text-accent-700 text-xs flex items-center justify-center font-medium">
                    {m.name[0]}
                  </span>
                  <span className="text-gray-700">{m.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    付 {formatCurrency(paid, currency)} / 分攤{" "}
                    {formatCurrency(owed, currency)}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      balance > 0
                        ? "text-green-600"
                        : balance < 0
                        ? "text-red-500"
                        : "text-gray-400"
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

function StatsView({
  expenses,
  currency,
  getCategoryInfo,
}: {
  expenses: Expense[];
  currency: string;
  getCategoryInfo: (v: string) => { label: string; emoji: string };
}) {
  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📊</div>
        <p className="text-gray-400">沒有消費數據可以統計</p>
      </div>
    );
  }

  const categoryTotals: Record<string, number> = {};
  const dailyTotals: Record<string, number> = {};

  expenses.forEach((e) => {
    const amountInBase = e.amount * e.exchangeRate;
    categoryTotals[e.category] =
      (categoryTotals[e.category] || 0) + amountInBase;
    const dateKey = new Date(e.date).toISOString().split("T")[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + amountInBase;
  });

  const sortedCategories = Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b - a
  );
  const total = sortedCategories.reduce((sum, [, v]) => sum + v, 0);
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

  const sortedDays = Object.entries(dailyTotals).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  const maxDaily = Math.max(...sortedDays.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          🥧 消費類別分佈
        </h3>
        <div className="flex rounded-full overflow-hidden h-4 mb-4">
          {sortedCategories.map(([cat, amount], i) => (
            <div
              key={cat}
              className={`${colors[i % colors.length]} transition-all`}
              style={{ width: `${(amount / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="space-y-2">
          {sortedCategories.map(([cat, amount], i) => {
            const info = getCategoryInfo(cat);
            const pct = ((amount / total) * 100).toFixed(1);
            return (
              <div key={cat} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      colors[i % colors.length]
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {info.emoji} {info.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrency(amount, currency)}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          📈 每日花費趨勢
        </h3>
        <div className="space-y-2">
          {sortedDays.map(([day, amount]) => (
            <div key={day} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-20">
                {day.slice(5)}
              </span>
              <div className="flex-1 bg-gray-50 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-400 to-primary-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                  style={{
                    width: `${Math.max((amount / maxDaily) * 100, 10)}%`,
                  }}
                >
                  <span className="text-xs text-white font-medium">
                    {formatCurrency(amount, currency)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
