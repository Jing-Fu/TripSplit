import {
  calculatePersonSettlementGroups,
  type PairwiseBreakdown,
  type SuggestedSettlement,
} from "@/lib/settlement";
import { useLocale } from "@/lib/i18n/context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryInfo } from "./helpers";
import type { CustomCategory, Expense, Member, Payment } from "./types";

type SettlementViewProps = {
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
  customCategories: CustomCategory[];
  canExportToNotion: boolean;
  exportingToNotion: boolean;
  onExportToNotion: () => void;
  canCompleteSettlement: boolean;
  completingSettlement: boolean;
  onCompleteSettlement: () => void;
};

export function SettlementView({
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
  canExportToNotion,
  exportingToNotion,
  onExportToNotion,
  canCompleteSettlement,
  completingSettlement,
  onCompleteSettlement,
}: SettlementViewProps) {
  const { t } = useLocale();
  const perPerson = members.length > 0 ? totalExpenses / members.length : 0;
  const specialExpenses = expenses.filter((expense) => expense.settlementMode !== "normal");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-accent-500 to-accent-600 p-4 text-white sm:p-5">
        <p className="text-sm opacity-80">{t("settlement.perPerson")}</p>
        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatCurrency(perPerson, currency)}</p>
        <p className="mt-1 text-sm opacity-60">
          {t("settlement.totalSummary")
            .replace("{count}", String(members.length))
            .replace("{amount}", formatCurrency(totalExpenses, currency))}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t("settlement.pendingTitle")}</h3>
            <p className="mt-1 text-xs text-gray-400">{t("settlement.pendingDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCompleteSettlement && settlements.length > 0 && (
              <button
                onClick={onCompleteSettlement}
                disabled={completingSettlement}
                className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:bg-primary-300 sm:text-sm"
              >
                {completingSettlement ? "推播中..." : "結算完成並推播"}
              </button>
            )}
            <button
              onClick={onExport}
              className="rounded-xl border border-primary-200 px-3 py-2 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 sm:text-sm"
            >
              {t("settlement.exportText")}
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
               {t("settlement.exportJson")}
            </button>
            <button
              onClick={onExportCSV}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:text-sm"
            >
               {t("settlement.exportCsv")}
            </button>
            {canExportToNotion && (
              <button
                onClick={onExportToNotion}
                disabled={exportingToNotion}
                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:border-stone-100 disabled:text-stone-400 sm:text-sm"
              >
                {exportingToNotion ? "📝 匯出中..." : "📝 匯出到 Notion"}
              </button>
            )}
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mb-3 text-5xl">✅</div>
            <p className="text-gray-500">{t("settlement.nonePending")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((settlement) => {
              const paymentKey = `${settlement.fromMemberId}:${settlement.toMemberId}`;
              const pairwise = pairwiseBreakdowns.find(
                (item) => item.fromMemberId === settlement.fromMemberId && item.toMemberId === settlement.toMemberId
              );

              return (
                <div key={paymentKey} className="rounded-xl border border-gray-100 px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {settlement.from} → {settlement.to}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                          {pairwise
                            ? t("settlement.originalItemsCount").replace("{count}", String(pairwise.items.length))
                            : t("settlement.optimizedSuggestion")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-600">{formatCurrency(settlement.amount, currency)}</span>
                      <button
                        onClick={() => onMarkPaid(settlement)}
                        disabled={processingPayment === paymentKey}
                        className="rounded-xl bg-primary-500 px-3 py-2 text-sm text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300"
                      >
                         {processingPayment === paymentKey ? t("common.processing") : t("settlement.markPaid")}
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
        <h3 className="mb-1 text-sm font-medium text-gray-500">{t("settlement.breakdownTitle")}</h3>
        <p className="mb-4 text-xs text-gray-400">{t("settlement.breakdownDescription")}</p>
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
                       {t("settlement.breakdownItems").replace("{count}", String(breakdown.items.length))}{" "}
                       {isExpanded ? t("settlement.collapse") : t("settlement.expand")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                     <p className="text-sm font-semibold text-primary-600">
                       {t("settlement.subtotal").replace("{amount}", formatCurrency(breakdown.amount, currency))}
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
                            <p className="text-sm font-semibold text-gray-700">{formatCurrency(item.amount, currency)}</p>
                            {item.originalCurrency !== currency && (
                              <p className="text-xs text-gray-400">
                                 {t("settlement.originalSplitAmount").replace(
                                   "{amount}",
                                   formatCurrency(item.originalAmount, item.originalCurrency)
                                 )}
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
          <h3 className="mb-1 text-sm font-medium text-gray-500">{t("settlement.excludedExpensesTitle")}</h3>
          <p className="mb-4 text-xs text-gray-400">{t("settlement.excludedExpensesDescription")}</p>
          <div className="space-y-2">
            {specialExpenses.map((expense) => (
              <div key={expense.id} className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{expense.description}</p>
                    <p className="mt-1 text-xs text-gray-500">
                       {expense.paidBy.name} · {expense.settlementMode === "exclude" ? t("expense.settlementExclude") : expense.settlementMode === "partial" ? `部分結算（${expense.settlementNote || "50"}%）` : t("expense.settlementExternalOption")}
                     </p>
                     {expense.settlementNote && (
                       <p className="mt-1 text-xs text-amber-700">
                         {t("settlement.note").replace("{note}", expense.settlementNote)}
                       </p>
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
        <h3 className="mb-1 text-sm font-medium text-gray-500">{t("settlement.personViewTitle")}</h3>
        <p className="mb-4 text-xs text-gray-400">{t("settlement.personViewDescription")}</p>
        <div className="space-y-4">
          {personSettlementGroups.map((group) => (
            <div key={group.memberId} className="rounded-2xl border border-gray-100 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-medium text-gray-800">{group.memberName}</h4>
                  <p className="mt-1 text-xs text-gray-400">
                     {t("settlement.toPayAndReceive")
                       .replace("{pay}", formatCurrency(group.totalToPay, currency))
                       .replace("{receive}", formatCurrency(group.totalToReceive, currency))}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-red-50/60 p-3">
                   <h5 className="text-sm font-medium text-red-600">{t("settlement.outgoingTitle")}</h5>
                  {group.outgoing.length === 0 ? (
                     <p className="mt-2 text-xs text-gray-400">{t("settlement.outgoingEmpty")}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {group.outgoing.map((item) => (
                        <div key={`${group.memberId}-${item.toMemberId}`} className="rounded-lg bg-white px-3 py-2">
                           <p className="text-sm text-gray-700">{t("settlement.payTo").replace("{name}", item.to)}</p>
                          <p className="text-sm font-semibold text-gray-800">{formatCurrency(item.amount, currency)}</p>
                          <p className="mt-1 text-xs text-gray-400">{item.items.map((expense) => expense.description).join("、")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-green-50/60 p-3">
                   <h5 className="text-sm font-medium text-green-600">{t("settlement.incomingTitle")}</h5>
                  {group.incoming.length === 0 ? (
                     <p className="mt-2 text-xs text-gray-400">{t("settlement.incomingEmpty")}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {group.incoming.map((item) => (
                        <div key={`${group.memberId}-${item.fromMemberId}`} className="rounded-lg bg-white px-3 py-2">
                           <p className="text-sm text-gray-700">{t("settlement.collectFrom").replace("{name}", item.from)}</p>
                          <p className="text-sm font-semibold text-gray-800">{formatCurrency(item.amount, currency)}</p>
                          <p className="mt-1 text-xs text-gray-400">{item.items.map((expense) => expense.description).join("、")}</p>
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
        <h3 className="mb-4 text-sm font-medium text-gray-500">{t("settlement.paidRecordsTitle")}</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400">{t("settlement.noPaidRecords")}</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {payment.fromMember.name} → {payment.toMember.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("settlement.markedBy")
                      .replace("{date}", formatDate(payment.settledAt))
                      .replace("{name}", payment.settledBy.name)
                      .replace("{status}", payment.status === "completed" ? t("common.completed") : t("common.cancelled"))}
                  </p>
                  {payment.note && <p className="mt-1 text-xs text-gray-400">{t("settlement.note").replace("{note}", payment.note)}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-700">{formatCurrency(payment.amount, payment.currency)}</span>
                  <button
                    onClick={() => onTogglePaymentStatus(payment.id, payment.status === "completed" ? "cancelled" : "completed")}
                    disabled={processingPayment === payment.id}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 active:bg-gray-50 disabled:text-gray-300"
                  >
                     {processingPayment === payment.id
                       ? t("common.processing")
                       : payment.status === "completed"
                         ? t("common.undo")
                         : t("common.restore")}
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
