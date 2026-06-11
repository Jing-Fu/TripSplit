export type ExpenseSplitInput = {
  memberId: string;
  amount: number;
};

const CENTS_PER_UNIT = 100;
const SPLIT_TOTAL_TOLERANCE = 0.01;

export function roundCurrencyAmount(amount: number) {
  return Math.round(amount * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}

export function splitAmountEvenly(amount: number, count: number) {
  if (count <= 0) return [];

  const totalCents = Math.round(amount * CENTS_PER_UNIT);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, index) =>
    (baseCents + (index < remainderCents ? 1 : 0)) / CENTS_PER_UNIT
  );
}

export function validateExpenseSplitTotal(
  amount: number,
  splits: ExpenseSplitInput[]
) {
  if (splits.length === 0) {
    return "請至少設定一位分攤對象";
  }

  const total = roundCurrencyAmount(
    splits.reduce((sum, split) => sum + split.amount, 0)
  );
  const expected = roundCurrencyAmount(amount);

  if (Math.abs(total - expected) > SPLIT_TOTAL_TOLERANCE) {
    return `分攤金額合計需等於費用金額（目前合計 ${total.toFixed(2)}，費用金額 ${expected.toFixed(2)}）`;
  }

  return null;
}
