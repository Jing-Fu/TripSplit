import type { SuggestedSettlement } from "@/lib/settlement";
import { useLocale } from "@/lib/i18n/context";
import { formatCurrency, formatDateForInput } from "@/lib/utils";
import { getCategoryInfo } from "./helpers";
import type { CustomCategory, Trip } from "./types";

type TripSummaryViewProps = {
  trip: Trip;
  totalExpenses: number;
  settlements: SuggestedSettlement[];
  customCategories: CustomCategory[];
};

function SummaryCard({ label, value, subLabel }: { label: string; value: string; subLabel: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-800">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subLabel}</p>
    </div>
  );
}

export function TripSummaryView({ trip, totalExpenses, settlements, customCategories }: TripSummaryViewProps) {
  const { t } = useLocale();
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
        <SummaryCard
          label={t("summary.totalExpense")}
          value={formatCurrency(totalExpenses, trip.currency)}
          subLabel={t("summary.expenseCount").replace("{count}", String(trip.expenses.length))}
        />
        <SummaryCard
          label={t("summary.pendingSettlementCount")}
          value={String(settlements.length)}
          subLabel={t("summary.pendingTransferDescription")}
        />
        <SummaryCard
          label={t("summary.includedInSettlement")}
          value={formatCurrency(settleableExpenses.reduce((sum, e) => sum + e.amount * e.exchangeRate, 0), trip.currency)}
          subLabel={t("summary.settleableExpenseCount").replace("{count}", String(settleableExpenses.length))}
        />
        <SummaryCard
          label={t("summary.specialExpenses")}
          value={String(specialExpenses.length)}
          subLabel={t("summary.excludedOrExternal")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-500">{t("summary.highlightsTitle")}</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>{t("summary.topPayer").replace("{name}", topPayer?.member.name || "-").replace("{amount}", formatCurrency(topPayer?.amount || 0, trip.currency))}</p>
            <p>
              {t("summary.largestExpense")
                .replace("{name}", largestExpense?.description || "-")
                .replace(
                  "{amount}",
                  largestExpense ? formatCurrency(largestExpense.amount * largestExpense.exchangeRate, trip.currency) : "-"
                )}
            </p>
            <p>
              {t("summary.busiestDay")
                .replace("{date}", busiestDay?.[0] || "-")
                .replace("{amount}", busiestDay ? formatCurrency(busiestDay[1], trip.currency) : "-")}
            </p>
            <p>
              {t("summary.topCategory")
                .replace(
                  "{name}",
                  topCategory
                    ? `${getCategoryInfo(topCategory[0], customCategories).emoji} ${getCategoryInfo(topCategory[0], customCategories).label}`
                    : "-"
                )
                .replace("{amount}", topCategory ? formatCurrency(topCategory[1], trip.currency) : "-")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-500">{t("summary.remindersTitle")}</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>{t("summary.pendingReminder").replace("{count}", String(settlements.length))}</p>
            <p>{t("summary.backupReminder")}</p>
            <p>{t("summary.specialReminder").replace("{count}", String(specialExpenses.length))}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
