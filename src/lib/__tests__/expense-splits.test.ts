import { describe, expect, it } from "vitest";
import { splitAmountEvenly, validateExpenseSplitTotal } from "../expense-splits";

describe("expense split helpers", () => {
  it("distributes rounding remainders so equal splits add up to the amount", () => {
    expect(splitAmountEvenly(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("rejects split totals that differ from the expense amount", () => {
    const error = validateExpenseSplitTotal(100, [
      { memberId: "member-1", amount: 60 },
      { memberId: "member-2", amount: 39 },
    ]);

    expect(error).toContain("分攤金額合計需等於費用金額");
  });
});
