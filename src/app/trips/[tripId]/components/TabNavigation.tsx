import type { Dispatch, SetStateAction } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { Tab, Trip } from "./types";

type TabNavigationProps = {
  trip: Trip;
  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;
  editingExpenseId: string | null;
};

export function TabNavigation({ trip, tab, setTab, editingExpenseId }: TabNavigationProps) {
  const { t } = useLocale();

  return (
    <div className="no-scrollbar mt-4 flex overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
      {(
        [
          { key: "expenses", label: t("trip.tabs.expenses"), count: trip.expenses.length },
          { key: "add", label: editingExpenseId ? t("trip.tabs.edit") : t("trip.tabs.add") },
          { key: "settle", label: t("trip.tabs.settle") },
          { key: "summary", label: t("trip.tabs.summary") },
          { key: "stats", label: t("trip.tabs.stats") },
          { key: "activity", label: t("trip.tabs.activity") },
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
          {"count" in item && item.count !== undefined && <span className="ml-1 text-xs opacity-70">({item.count})</span>}
        </button>
      ))}
    </div>
  );
}
