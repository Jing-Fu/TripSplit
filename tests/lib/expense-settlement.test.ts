import { describe, expect, it } from "vitest";
import {
  isExpenseSettleable,
  normalizeExpenseSettlementMode,
  normalizeExpenseSettlementNote,
} from "@/lib/expense-settlement";

describe("expense settlement normalization", () => {
  it("normalizes legacy partial mode to exclude", () => {
    expect(normalizeExpenseSettlementMode("partial")).toBe("exclude");
    expect(isExpenseSettleable("partial")).toBe(false);
  });

  it("drops partial percentage notes when normalizing", () => {
    expect(normalizeExpenseSettlementNote("partial", "50")).toBeNull();
  });

  it("keeps exclude notes intact", () => {
    expect(normalizeExpenseSettlementNote("exclude", "公司報帳")).toBe(
      "公司報帳"
    );
  });
});
