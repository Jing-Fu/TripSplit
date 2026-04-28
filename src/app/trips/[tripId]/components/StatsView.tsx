import { useLocale } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import { getCategoryInfo } from "./helpers";
import type { CustomCategory, Expense } from "./types";

type StatsViewProps = {
  expenses: Expense[];
  currency: string;
  customCategories: CustomCategory[];
};

export function StatsView({ expenses, currency, customCategories }: StatsViewProps) {
  const { t } = useLocale();

  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📊</div>
        <p className="text-gray-400">{t("stats.empty")}</p>
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
        <h3 className="mb-4 text-sm font-medium text-gray-500">{t("stats.categoryDistribution")}</h3>
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
        <h3 className="mb-4 text-sm font-medium text-gray-500">{t("stats.dailyTrend")}</h3>
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
