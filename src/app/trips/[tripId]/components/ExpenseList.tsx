import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EMPTY_FILTERS, type CustomCategory, type Expense, type ExpenseFilters, type Member } from "./types";
import { getCategoryInfo } from "./helpers";

type ExpenseListProps = {
  expenses: Expense[];
  allExpenses: Expense[];
  currency: string;
  totalExpenses: number;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
  filters: ExpenseFilters;
  setFilters: Dispatch<SetStateAction<ExpenseFilters>>;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
  customCategories: CustomCategory[];
};

export function ExpenseList({
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
}: ExpenseListProps) {
  const { t } = useLocale();
  const [previewExpenseId, setPreviewExpenseId] = useState<string | null>(null);
  const previewExpense = previewExpenseId
    ? allExpenses.find((expense) => expense.id === previewExpenseId) ??
      expenses.find((expense) => expense.id === previewExpenseId) ??
      null
    : null;
  const previewCategory = previewExpense
    ? getCategoryInfo(previewExpense.category, customCategories)
    : null;

  useEffect(() => {
    if (previewExpenseId && !previewExpense) {
      setPreviewExpenseId(null);
    }
  }, [previewExpense, previewExpenseId]);

  useEffect(() => {
    if (!previewExpense) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewExpenseId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewExpense]);

  const canManageExpense = (expense: Expense) =>
    isOwner || expense.createdBy?.id === currentUserId || expense.paidBy.userId === currentUserId;

  const closePreview = () => setPreviewExpenseId(null);
  const getSplitTypeLabel = (splitType: string) => {
    const labels: Record<string, string> = {
      equal: t("expense.splitEqual"),
      percentage: t("expense.splitPercentage"),
      exact: t("expense.splitExact"),
      payer_only: t("expense.splitPayerOnly"),
    };

    return labels[splitType] ?? splitType;
  };

  if (allExpenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📝</div>
        <p className="text-gray-400">{t("expense.empty")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white sm:p-5">
        <p className="text-sm opacity-80">{hasActiveFilters ? t("expense.filteredResult") : t("expense.total")}</p>
        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatCurrency(totalExpenses, currency)}</p>
        <p className="mt-1 text-sm opacity-60">
          {hasActiveFilters
            ? t("expense.countWithTotal")
                .replace("{filtered}", String(expenses.length))
                .replace("{total}", String(allExpenses.length))
            : t("expense.count").replace("{count}", String(expenses.length))}
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-600"
        >
          <span className="flex items-center gap-2">
            {t("expense.searchFilters")}
            {hasActiveFilters && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-600">
                 {t("expense.filtering")}
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
                placeholder={t("expense.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">{t("expense.allCategories")}</option>
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
                  <option value="">{t("expense.allPayers")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("expense.startDate")}</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("expense.endDate")}</label>
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
                   {t("expense.clearAllFilters")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {expenses.length === 0 && hasActiveFilters ? (
        <div className="py-12 text-center">
          <div className="mb-3 text-5xl">🔍</div>
          <p className="text-gray-400">{t("expense.noMatchingResults")}</p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-3 text-sm text-primary-500 hover:text-primary-700"
          >
            {t("expense.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const category = getCategoryInfo(expense.category, customCategories);
            const canManage = canManageExpense(expense);

            return (
              <div
                key={expense.id}
                className="group relative rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-colors hover:border-primary-100 hover:bg-primary-50/20 sm:p-4"
              >
                <button
                  type="button"
                  aria-label={t("expense.openPreview").replace("{name}", expense.description)}
                  onClick={() => setPreviewExpenseId(expense.id)}
                  className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                    <span className="mt-0.5 shrink-0 text-xl sm:text-2xl">{category.emoji}</span>
                    <div className="min-w-0">
                      <h4 className="truncate font-medium text-gray-800">{expense.description}</h4>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {category.label} · {formatDate(expense.date)} · {t("expense.paidBy").replace("{name}", expense.paidBy.name)}
                      </p>
                      {expense.createdBy && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {t("expense.creator").replace("{name}", expense.createdBy.name)}
                        </p>
                      )}
                      {expense.note && <p className="mt-0.5 text-xs text-gray-400">💬 {expense.note}</p>}
                      {expense.settlementMode !== "normal" && (
                        <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                          {expense.settlementMode === "exclude"
                            ? t("expense.settlementExcluded")
                            : expense.settlementMode === "partial"
                              ? `部分結算（${expense.settlementNote || "50"}%）`
                              : t("expense.settlementExternal")}
                          {expense.settlementMode !== "partial" && expense.settlementNote ? `：${expense.settlementNote}` : ""}
                        </p>
                      )}
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pointer-events-auto mt-0.5 inline-block text-xs text-primary-500 hover:underline"
                        >
                           📎 {t("common.viewReceipt")}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(expense);
                          }}
                          className="pointer-events-auto min-h-[28px] min-w-[40px] text-primary-500 transition-colors hover:text-primary-700"
                        >
                           {t("common.edit")}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(expense.id);
                          }}
                          className="pointer-events-auto min-h-[28px] min-w-[40px] text-gray-300 transition-colors hover:text-red-400"
                        >
                           {t("common.delete")}
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

      {previewExpense && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-gray-950/40 px-0 sm:items-center sm:justify-center sm:px-4"
          onClick={closePreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-preview-title"
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:px-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 shrink-0 rounded-2xl bg-primary-50 px-3 py-2 text-2xl">
                    {previewCategory?.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {t("expense.previewTitle")}
                    </p>
                    <h3 id="expense-preview-title" className="mt-1 truncate text-xl font-bold text-gray-900">
                      {previewExpense.description}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {previewCategory?.label} · {formatDate(previewExpense.date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  {t("expense.closePreview")}
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
                <p className="text-sm opacity-75">{t("expense.amountPreview")}</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(previewExpense.amount, previewExpense.currency)}</p>
                {previewExpense.currency !== currency && (
                  <p className="mt-1 text-sm opacity-75">
                    {t("expense.convertedAmount").replace(
                      "{amount}",
                      formatCurrency(previewExpense.amount * previewExpense.exchangeRate, currency)
                    )}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-400">{t("expense.paidByPreview")}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{previewExpense.paidBy.name}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-400">{t("expense.creatorPreview")}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {previewExpense.createdBy?.name ?? t("common.system")}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-400">{t("expense.category")}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {previewCategory?.emoji} {previewCategory?.label}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs text-gray-400">{t("expense.splitType")}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{getSplitTypeLabel(previewExpense.splitType)}</p>
                </div>
              </div>

              {(previewExpense.note || previewExpense.settlementMode !== "normal" || previewExpense.receiptUrl) && (
                <div className="space-y-2 rounded-2xl border border-gray-100 p-3">
                  {previewExpense.note && (
                    <div>
                      <p className="text-xs text-gray-400">{t("expense.note")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{previewExpense.note}</p>
                    </div>
                  )}
                  {previewExpense.settlementMode !== "normal" && (
                    <p className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {previewExpense.settlementMode === "exclude"
                        ? t("expense.settlementExcluded")
                        : previewExpense.settlementMode === "partial"
                          ? `部分結算（${previewExpense.settlementNote || "50"}%）`
                          : t("expense.settlementExternal")}
                      {previewExpense.settlementMode !== "partial" && previewExpense.settlementNote
                        ? `：${previewExpense.settlementNote}`
                        : ""}
                    </p>
                  )}
                  {previewExpense.receiptUrl && (
                    <a
                      href={previewExpense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-xl border border-primary-200 px-3 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                    >
                      📎 {t("common.viewReceipt")}
                    </a>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-700">{t("expense.splitPreviewTitle")}</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {t("expense.splitPreviewCount").replace("{count}", String(previewExpense.splits.length))}
                  </span>
                </div>
                {previewExpense.splits.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("expense.noSplitPreview")}</p>
                ) : (
                  <div className="space-y-2">
                    {previewExpense.splits.map((split) => (
                      <div key={split.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                        <p className="min-w-0 truncate text-sm text-gray-700">{split.member.name}</p>
                        <p className="shrink-0 text-sm font-semibold text-gray-800">
                          {formatCurrency(split.amount, previewExpense.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  {t("expense.closePreview")}
                </button>
                {canManageExpense(previewExpense) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        closePreview();
                        onEdit(previewExpense);
                      }}
                      className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(previewExpense.id)}
                      className="rounded-xl border border-red-100 px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
                    >
                      {t("common.delete")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
