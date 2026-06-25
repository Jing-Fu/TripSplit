import { describe, expect, it } from "vitest";

import { buildSplits } from "./helpers";
import type { ExpenseFormState, Member } from "./types";

const members = [
  { id: "member-1", name: "Alice" },
  { id: "member-2", name: "Bob" },
  { id: "member-3", name: "Chris" },
] as Member[];

const baseForm: ExpenseFormState = {
  amount: "100",
  currency: "TWD",
  category: "food",
  description: "Dinner",
  note: "",
  settlementMode: "normal",
  settlementNote: "",
  date: "2026-06-25",
  paidById: "member-1",
  splitType: "equal",
  receiptKey: "",
  receiptUrl: "",
  exchangeRate: "1",
};

describe("buildSplits", () => {
  it("splits equally across selected members only", () => {
    expect(buildSplits(baseForm, members, {}, { "member-3": false })).toEqual([
      { memberId: "member-1", amount: 50 },
      { memberId: "member-2", amount: 50 },
    ]);
  });

  it("keeps exact splits independent from equal split member selection", () => {
    expect(
      buildSplits(
        { ...baseForm, splitType: "exact" },
        members,
        { "member-1": "60", "member-3": "40" },
        { "member-3": false }
      )
    ).toEqual([
      { memberId: "member-1", amount: 60 },
      { memberId: "member-3", amount: 40 },
    ]);
  });
});
