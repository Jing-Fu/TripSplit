export type ExpenseSettlementMode = "normal" | "exclude";

export function normalizeExpenseSettlementMode(
  mode: string | null | undefined
): ExpenseSettlementMode {
  if (mode === "exclude" || mode === "external" || mode === "partial") {
    return "exclude";
  }

  return "normal";
}

export function normalizeExpenseSettlementNote(
  mode: string | null | undefined,
  note: string | null | undefined
) {
  if (mode === "partial") {
    return null;
  }

  return note ?? null;
}

export function isExpenseSettleable(mode: string | null | undefined) {
  return normalizeExpenseSettlementMode(mode) === "normal";
}
