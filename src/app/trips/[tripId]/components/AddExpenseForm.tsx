import { useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { CURRENCIES, SPLIT_TYPES } from "@/lib/constants";
import { safeFetch } from "@/lib/fetch";
import { useLocale } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import type { CategoryOption, CustomCategory, ExpenseFormState, Member } from "./types";

type AddExpenseFormProps = {
  members: Member[];
  tripCurrency: string;
  form: ExpenseFormState;
  setForm: Dispatch<SetStateAction<ExpenseFormState>>;
  customSplits: Record<string, string>;
  setCustomSplits: Dispatch<SetStateAction<Record<string, string>>>;
  saving: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  submitLabel: string;
  onError: (msg: string) => void;
  allCategories: CategoryOption[];
  customCategories: CustomCategory[];
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
  editingExpenseId?: string | null;
};

export function AddExpenseForm({
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
  editingExpenseId,
}: AddExpenseFormProps) {
  const { t } = useLocale();
  const [uploading, setUploading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  const removeReceipt = async () => {
    const key = form.receiptKey;
    setForm((prev) => ({ ...prev, receiptKey: "", receiptUrl: "" }));

    if (!key) return;

    if (editingExpenseId) return;

    const res = await safeFetch(`/api/upload/object?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });

    if (res.status === 0) {
      onError(t("expense.receiptUploadNetworkFailed"));
      return;
    }

    if (!res.ok) {
      onError(t("expense.receiptUploadFailed"));
    }
  };

  const fetchExchangeRate = async (from: string, to: string) => {
    if (from === to) {
      setForm((prev) => ({ ...prev, exchangeRate: "1" }));
      return;
    }

    setRateLoading(true);
    try {
      const res = await safeFetch(`/api/exchange-rate?from=${from}&to=${to}`);
      if (res.status === 0) {
        onError(t("expense.exchangeRateLookupNetworkFailed"));
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, exchangeRate: String(data.rate) }));
      } else {
        onError(t("expense.exchangeRateLookupFailed"));
      }
    } finally {
      setRateLoading(false);
    }
  };

  const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onError(t("expense.receiptTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await safeFetch("/api/upload", { method: "POST", body: formData });
      if (res.status === 0) {
        onError(t("expense.receiptUploadNetworkFailed"));
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, receiptKey: data.key, receiptUrl: data.url }));
      } else {
        onError(t("expense.receiptUploadFailed"));
      }
    } finally {
      setUploading(false);
    }
  };

  if (members.length === 0) {
    return <div className="py-12 text-center text-gray-400">{t("expense.memberDataRequired")}</div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.amount")}</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.currency")}</label>
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
          <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.description")}</label>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder={t("expense.descriptionPlaceholder")}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-600">{t("expense.category")}</label>
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
                      <span className="text-sm text-gray-700">
                        {cat.emoji} {cat.label} <span className="text-xs text-gray-400">({cat.value})</span>
                      </span>
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
            <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.date")}</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.whoPaid")}</label>
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
          <label className="mb-1 block text-sm font-medium text-gray-600">{t("expense.note")}</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder={t("expense.notePlaceholder")}
          />
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("expense.settlementHandling")}</label>
          <select
            value={form.settlementMode}
            onChange={(e) => setForm((prev) => ({ ...prev, settlementMode: e.target.value }))}
            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="normal">{t("expense.settlementNormal")}</option>
            <option value="exclude">{t("expense.settlementExclude")}</option>
            <option value="external">{t("expense.settlementExternalOption")}</option>
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
                   placeholder={t("expense.settlementNotePlaceholder")}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <label className="mb-2 block text-sm font-medium text-gray-600">{t("expense.splitType")}</label>
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
                  onChange={(e) => setCustomSplits((prev) => ({ ...prev, [member.id]: e.target.value }))}
                   placeholder={form.splitType === "percentage" ? "%" : t("expense.exactAmount")}
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
            {t("expense.exchangeRate").replace("{from}", form.currency).replace("{to}", tripCurrency)}
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
            {rateLoading && <span className="text-sm text-gray-400">{t("common.querying")}</span>}
            {form.amount && (
              <span className="text-sm text-gray-500">
                ≈ {formatCurrency(parseFloat(form.amount) * parseFloat(form.exchangeRate || "1"), tripCurrency)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <label className="mb-2 block text-sm font-medium text-gray-600">{t("expense.receiptPhoto")}</label>
        {form.receiptUrl ? (
          <div className="relative">
            <img src={form.receiptUrl} alt={t("expense.receiptAlt")} className="max-h-48 w-full rounded-xl object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                onClick={removeReceipt}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white hover:bg-black/70"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 transition-colors hover:border-primary-300 hover:bg-primary-50/30 active:bg-primary-50/50">
            <span className="mb-2 text-3xl">📷</span>
             <span className="text-sm text-gray-400">
               {uploading ? t("common.uploading") : t("expense.receiptUploadPrompt")}
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-primary-500 py-3.5 font-semibold text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300"
        >
           {saving ? t("common.saving") : `💾 ${submitLabel}`}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-gray-200 px-5 py-3.5 font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
