import type { Dispatch, SetStateAction } from "react";
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
                          className="mt-0.5 inline-block text-xs text-primary-500 hover:underline"
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
                          onClick={() => onEdit(expense)}
                          className="min-h-[28px] min-w-[40px] text-primary-500 transition-colors hover:text-primary-700"
                        >
                           {t("common.edit")}
                        </button>
                        <button
                          onClick={() => onDelete(expense.id)}
                          className="min-h-[28px] min-w-[40px] text-gray-300 transition-colors hover:text-red-400"
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
    </div>
  );
}
