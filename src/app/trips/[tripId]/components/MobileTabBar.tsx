import type { Dispatch, SetStateAction } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { Tab } from "./types";

type MobileTabBarProps = {
  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;
};

export function MobileTabBar({ tab, setTab }: MobileTabBarProps) {
  const { t } = useLocale();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white/95 pb-safe backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 pt-2">
        <button
          onClick={() => setTab("expenses")}
          className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "expenses" ? "text-primary-600 font-medium" : "text-gray-400"}`}
        >
          <span className="text-base">📋</span>
          {t("navigation.expenses")}
        </button>
        <button
          onClick={() => setTab("add")}
          className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "add" ? "text-primary-600 font-medium" : "text-gray-400"}`}
        >
          <span className="text-base">✏️</span>
          {t("navigation.addExpense")}
        </button>
        <button
          onClick={() => setTab("settle")}
          className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "settle" ? "text-primary-600 font-medium" : "text-gray-400"}`}
        >
          <span className="text-base">💰</span>
          {t("navigation.settlement")}
        </button>
        <button
          onClick={() => setTab("summary")}
          className={`min-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors ${tab === "summary" ? "text-primary-600 font-medium" : "text-gray-400"}`}
        >
          <span className="text-base">📊</span>
          {t("navigation.summary")}
        </button>
      </div>
    </div>
  );
}
