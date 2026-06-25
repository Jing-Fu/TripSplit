import { isExpenseSettleable } from "@/lib/expense-settlement";

type SettlementMember = {
  id: string;
  name: string;
  userId?: string | null;
};

type SettlementSplit = {
  id: string;
  amount: number;
  member: SettlementMember;
};

export type SettlementExpense = {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  category: string;
  description: string;
  note?: string | null;
  settlementMode?: string;
  settlementNote?: string | null;
  date: string;
  paidBy: SettlementMember;
  splits: SettlementSplit[];
};

export type RecordedSettlementPayment = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  status: string;
  settledAt: string;
  fromMember: SettlementMember;
  toMember: SettlementMember;
};

export type SuggestedSettlement = {
  fromMemberId: string;
  from: string;
  toMemberId: string;
  to: string;
  amount: number;
};

export type SettlementBreakdownItem = {
  expenseId: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  originalAmount: number;
  originalCurrency: string;
};

export type PairwiseBreakdown = {
  fromMemberId: string;
  from: string;
  toMemberId: string;
  to: string;
  amount: number;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  items: SettlementBreakdownItem[];
};

export type PersonSettlementGroup = {
  memberId: string;
  memberName: string;
  outgoing: PairwiseBreakdown[];
  incoming: PairwiseBreakdown[];
  totalToPay: number;
  totalToReceive: number;
  totalPaidByMember: number;
  totalPaidToMember: number;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getPaymentKey(fromMemberId: string, toMemberId: string) {
  return `${fromMemberId}:${toMemberId}`;
}

function getCompletedPaymentTotals(payments: RecordedSettlementPayment[] = []) {
  const totals = new Map<string, number>();

  payments
    .filter((payment) => payment.status === "completed")
    .forEach((payment) => {
      const key = getPaymentKey(payment.fromMember.id, payment.toMember.id);
      totals.set(key, roundCurrency((totals.get(key) ?? 0) + payment.amount));
    });

  return totals;
}

export function calculateSuggestedSettlements(
  members: SettlementMember[],
  expenses: SettlementExpense[],
  payments: RecordedSettlementPayment[] = []
): SuggestedSettlement[] {
  const settleableExpenses = expenses.filter((expense) =>
    isExpenseSettleable(expense.settlementMode)
  );
  const balances: Record<string, number> = {};

  members.forEach((member) => {
    balances[member.id] = 0;
  });

  settleableExpenses.forEach((expense) => {
    const amountInBase = expense.amount * expense.exchangeRate;
    balances[expense.paidBy.id] = (balances[expense.paidBy.id] || 0) + amountInBase;

    expense.splits.forEach((split) => {
      balances[split.member.id] =
        (balances[split.member.id] || 0) - split.amount * expense.exchangeRate;
    });
  });

  getCompletedPaymentTotals(payments).forEach((amount, key) => {
    const [fromMemberId, toMemberId] = key.split(":");
    balances[fromMemberId] = (balances[fromMemberId] || 0) + amount;
    balances[toMemberId] = (balances[toMemberId] || 0) - amount;
  });

  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  members.forEach((member) => {
    const balance = balances[member.id] || 0;
    if (balance < -0.01) {
      debtors.push({ id: member.id, name: member.name, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ id: member.id, name: member.name, amount: balance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: SuggestedSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const transfer = Math.min(
      debtors[debtorIndex].amount,
      creditors[creditorIndex].amount
    );

    if (transfer > 0.01) {
      settlements.push({
        fromMemberId: debtors[debtorIndex].id,
        from: debtors[debtorIndex].name,
        toMemberId: creditors[creditorIndex].id,
        to: creditors[creditorIndex].name,
        amount: Math.round(transfer * 100) / 100,
      });
    }

    debtors[debtorIndex].amount -= transfer;
    creditors[creditorIndex].amount -= transfer;

    if (debtors[debtorIndex].amount < 0.01) debtorIndex += 1;
    if (creditors[creditorIndex].amount < 0.01) creditorIndex += 1;
  }

  return settlements;
}

export function calculatePairwiseBreakdown(
  expenses: SettlementExpense[],
  payments: RecordedSettlementPayment[] = []
): PairwiseBreakdown[] {
  const settleableExpenses = expenses.filter((expense) =>
    isExpenseSettleable(expense.settlementMode)
  );
  const breakdownMap = new Map<string, PairwiseBreakdown>();
  const completedPaymentTotals = getCompletedPaymentTotals(payments);

  settleableExpenses.forEach((expense) => {
    expense.splits.forEach((split) => {
      if (split.member.id === expense.paidBy.id) {
        return;
      }

      const amount = Math.round(split.amount * expense.exchangeRate * 100) / 100;

      if (amount <= 0) {
        return;
      }

      const key = getPaymentKey(split.member.id, expense.paidBy.id);
      const item: SettlementBreakdownItem = {
        expenseId: expense.id,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        amount,
        paidAmount: 0,
        remainingAmount: amount,
        originalAmount: split.amount,
        originalCurrency: expense.currency,
      };
      const existing = breakdownMap.get(key);

      if (existing) {
        existing.amount = roundCurrency(existing.amount + amount);
        existing.originalAmount = roundCurrency(existing.originalAmount + amount);
        existing.remainingAmount = existing.amount;
        existing.items.push(item);
        return;
      }

      breakdownMap.set(key, {
        fromMemberId: split.member.id,
        from: split.member.name,
        toMemberId: expense.paidBy.id,
        to: expense.paidBy.name,
        amount,
        originalAmount: amount,
        paidAmount: 0,
        remainingAmount: amount,
        items: [item],
      });
    });
  });

  return Array.from(breakdownMap.values())
    .map((entry) => {
      const paidAmount = roundCurrency(
        Math.min(
          completedPaymentTotals.get(getPaymentKey(entry.fromMemberId, entry.toMemberId)) ?? 0,
          entry.originalAmount
        )
      );
      let remainingPaidAmount = paidAmount;
      const items = entry.items
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((item) => {
          const itemPaidAmount = roundCurrency(Math.min(item.amount, remainingPaidAmount));
          remainingPaidAmount = roundCurrency(remainingPaidAmount - itemPaidAmount);
          const remainingAmount = roundCurrency(item.amount - itemPaidAmount);

          return {
            ...item,
            amount: remainingAmount,
            paidAmount: itemPaidAmount,
            remainingAmount,
          };
        });
      const remainingAmount = roundCurrency(entry.originalAmount - paidAmount);

      return {
        ...entry,
        amount: remainingAmount,
        paidAmount,
        remainingAmount,
        items,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.originalAmount - a.originalAmount);
}

export function calculatePersonSettlementGroups(
  members: SettlementMember[],
  pairwiseBreakdowns: PairwiseBreakdown[]
): PersonSettlementGroup[] {
  return members.map((member) => {
    const outgoing = pairwiseBreakdowns.filter(
      (breakdown) => breakdown.fromMemberId === member.id
    );
    const incoming = pairwiseBreakdowns.filter(
      (breakdown) => breakdown.toMemberId === member.id
    );

    return {
      memberId: member.id,
      memberName: member.name,
      outgoing,
      incoming,
      totalToPay: outgoing.reduce((sum, item) => sum + item.amount, 0),
      totalToReceive: incoming.reduce((sum, item) => sum + item.amount, 0),
      totalPaidByMember: outgoing.reduce((sum, item) => sum + item.paidAmount, 0),
      totalPaidToMember: incoming.reduce((sum, item) => sum + item.paidAmount, 0),
    };
  });
}

export function exportSettlementSummaryAsText(
  groups: PersonSettlementGroup[],
  payments: RecordedSettlementPayment[]
) {
  const sections = groups.map((group) => {
    const outgoing =
      group.outgoing.length > 0
        ? group.outgoing
            .map(
              (item) =>
                `  - 付給 ${item.to}：剩餘 ${item.remainingAmount.toFixed(2)}（原始 ${item.originalAmount.toFixed(
                  2
                )}，已付 ${item.paidAmount.toFixed(2)}；${item.items
                  .map((expense) => expense.description)
                  .join("、")}）`
            )
            .join("\n")
        : "  - 無待付款項";

    const incoming =
      group.incoming.length > 0
        ? group.incoming
            .map(
              (item) =>
                `  - 向 ${item.from} 收款：剩餘 ${item.remainingAmount.toFixed(2)}（原始 ${item.originalAmount.toFixed(
                  2
                )}，已付 ${item.paidAmount.toFixed(2)}；${item.items
                  .map((expense) => expense.description)
                  .join("、")}）`
            )
            .join("\n")
        : "  - 無待收款項";

    return [
      `${group.memberName}`,
      `待付總額：${group.totalToPay.toFixed(2)}`,
      `已付出：${group.totalPaidByMember.toFixed(2)}`,
      outgoing,
      `待收總額：${group.totalToReceive.toFixed(2)}`,
      `已收款：${group.totalPaidToMember.toFixed(2)}`,
      incoming,
    ].join("\n");
  });

  const paymentHistory =
    payments.filter((payment) => payment.status === "completed").length > 0
      ? payments
          .filter((payment) => payment.status === "completed")
          .map(
            (payment) =>
              `- ${payment.fromMember.name} → ${payment.toMember.name}：${payment.amount.toFixed(
                2
              )}${payment.note ? `（備註：${payment.note}）` : ""}`
          )
          .join("\n")
      : "- 尚無已標記付款";

  return [`TripSplit 結算明細`, ...sections, `已付款紀錄`, paymentHistory].join(
    "\n\n"
  );
}
