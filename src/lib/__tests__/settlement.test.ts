import { describe, expect, it } from "vitest";
import {
  calculateSuggestedSettlements,
  calculatePairwiseBreakdown,
  calculatePersonSettlementGroups,
} from "../settlement";

const alice = { id: "a", name: "Alice" };
const bob = { id: "b", name: "Bob" };
const charlie = { id: "c", name: "Charlie" };

function makeExpense(
  overrides: Partial<{
    id: string;
    amount: number;
    paidBy: typeof alice;
    splits: { id: string; amount: number; member: typeof alice }[];
    settlementMode: string;
    settlementNote: string | null;
    currency: string;
    exchangeRate: number;
  }> = {}
) {
  return {
    id: overrides.id ?? "e1",
    amount: overrides.amount ?? 300,
    currency: overrides.currency ?? "TWD",
    exchangeRate: overrides.exchangeRate ?? 1,
    category: "food",
    description: "lunch",
    date: "2025-01-01",
    paidBy: overrides.paidBy ?? alice,
    settlementMode: overrides.settlementMode ?? "normal",
    settlementNote: overrides.settlementNote ?? null,
    splits: overrides.splits ?? [
      { id: "s1", amount: 100, member: alice },
      { id: "s2", amount: 100, member: bob },
      { id: "s3", amount: 100, member: charlie },
    ],
  };
}

describe("calculateSuggestedSettlements", () => {
  it("returns empty when no expenses", () => {
    const result = calculateSuggestedSettlements([alice, bob], []);
    expect(result).toEqual([]);
  });

  it("settles a simple 3-way equal split", () => {
    const expense = makeExpense({ amount: 300, paidBy: alice });
    const settlements = calculateSuggestedSettlements(
      [alice, bob, charlie],
      [expense]
    );

    expect(settlements).toHaveLength(2);
    const bobSettlement = settlements.find((s) => s.fromMemberId === "b");
    const charlieSettlement = settlements.find((s) => s.fromMemberId === "c");

    expect(bobSettlement?.toMemberId).toBe("a");
    expect(bobSettlement?.amount).toBe(100);
    expect(charlieSettlement?.toMemberId).toBe("a");
    expect(charlieSettlement?.amount).toBe(100);
  });

  it("accounts for completed payments", () => {
    const expense = makeExpense({ amount: 300, paidBy: alice });
    const payment = {
      id: "p1",
      amount: 100,
      currency: "TWD",
      note: null,
      status: "completed",
      settledAt: "2025-01-02",
      fromMember: bob,
      toMember: alice,
    };

    const settlements = calculateSuggestedSettlements(
      [alice, bob, charlie],
      [expense],
      [payment]
    );

    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromMemberId).toBe("c");
    expect(settlements[0].amount).toBe(100);
  });

  it("ignores cancelled payments", () => {
    const expense = makeExpense({ amount: 300, paidBy: alice });
    const payment = {
      id: "p1",
      amount: 100,
      currency: "TWD",
      note: null,
      status: "cancelled",
      settledAt: "2025-01-02",
      fromMember: bob,
      toMember: alice,
    };

    const settlements = calculateSuggestedSettlements(
      [alice, bob, charlie],
      [expense],
      [payment]
    );

    expect(settlements).toHaveLength(2);
  });

  it("excludes expenses with mode 'exclude'", () => {
    const expense = makeExpense({
      amount: 300,
      paidBy: alice,
      settlementMode: "exclude",
    });
    const settlements = calculateSuggestedSettlements(
      [alice, bob, charlie],
      [expense]
    );
    expect(settlements).toEqual([]);
  });

  it("treats legacy partial mode as excluded from settlement", () => {
    const expense = makeExpense({
      amount: 300,
      paidBy: alice,
      settlementMode: "partial",
      settlementNote: "50",
    });

    const settlements = calculateSuggestedSettlements(
      [alice, bob, charlie],
      [expense]
    );

    expect(settlements).toEqual([]);
  });

  it("handles exchange rate correctly", () => {
    const expense = makeExpense({
      amount: 100,
      currency: "USD",
      exchangeRate: 30,
      paidBy: alice,
      splits: [
        { id: "s1", amount: 50, member: alice },
        { id: "s2", amount: 50, member: bob },
      ],
    });

    const settlements = calculateSuggestedSettlements(
      [alice, bob],
      [expense]
    );

    expect(settlements).toHaveLength(1);
    expect(settlements[0].amount).toBe(1500);
  });
});

describe("calculatePairwiseBreakdown", () => {
  it("returns empty for no expenses", () => {
    expect(calculatePairwiseBreakdown([])).toEqual([]);
  });

  it("creates pairwise breakdowns excluding self-payments", () => {
    const expense = makeExpense({ amount: 300, paidBy: alice });
    const breakdowns = calculatePairwiseBreakdown([expense]);

    expect(breakdowns).toHaveLength(2);
    expect(breakdowns.every((b) => b.toMemberId === "a")).toBe(true);
    const fromIds = breakdowns.map((b) => b.fromMemberId).sort();
    expect(fromIds).toEqual(["b", "c"]);
  });

  it("aggregates multiple expenses between same pair", () => {
    const expenses = [
      makeExpense({ id: "e1", amount: 200, paidBy: alice, splits: [
        { id: "s1", amount: 100, member: alice },
        { id: "s2", amount: 100, member: bob },
      ]}),
      makeExpense({ id: "e2", amount: 100, paidBy: alice, splits: [
        { id: "s3", amount: 50, member: alice },
        { id: "s4", amount: 50, member: bob },
      ]}),
    ];

    const breakdowns = calculatePairwiseBreakdown(expenses);
    const bobToAlice = breakdowns.find(
      (b) => b.fromMemberId === "b" && b.toMemberId === "a"
    );

    expect(bobToAlice?.amount).toBe(150);
    expect(bobToAlice?.originalAmount).toBe(150);
    expect(bobToAlice?.paidAmount).toBe(0);
    expect(bobToAlice?.remainingAmount).toBe(150);
    expect(bobToAlice?.items).toHaveLength(2);
  });

  it("applies completed payments to pairwise and item details", () => {
    const expenses = [
      makeExpense({ id: "e1", amount: 200, paidBy: alice, splits: [
        { id: "s1", amount: 100, member: alice },
        { id: "s2", amount: 100, member: bob },
      ]}),
      makeExpense({ id: "e2", amount: 100, paidBy: alice, splits: [
        { id: "s3", amount: 50, member: alice },
        { id: "s4", amount: 50, member: bob },
      ]}),
    ];
    const payments = [
      {
        id: "p1",
        amount: 120,
        currency: "TWD",
        note: null,
        status: "completed",
        settledAt: "2025-01-02",
        fromMember: bob,
        toMember: alice,
      },
      {
        id: "p2",
        amount: 20,
        currency: "TWD",
        note: null,
        status: "cancelled",
        settledAt: "2025-01-03",
        fromMember: bob,
        toMember: alice,
      },
    ];

    const breakdowns = calculatePairwiseBreakdown(expenses, payments);
    const bobToAlice = breakdowns.find(
      (breakdown) => breakdown.fromMemberId === "b" && breakdown.toMemberId === "a"
    );

    expect(bobToAlice?.originalAmount).toBe(150);
    expect(bobToAlice?.paidAmount).toBe(120);
    expect(bobToAlice?.remainingAmount).toBe(30);
    expect(bobToAlice?.amount).toBe(30);
    expect(bobToAlice?.items.map((item) => item.remainingAmount).sort((a, b) => a - b)).toEqual([0, 30]);
  });
});

describe("calculatePersonSettlementGroups", () => {
  it("organizes breakdowns per person", () => {
    const breakdowns: Parameters<typeof calculatePersonSettlementGroups>[1] = [
      {
        fromMemberId: "b",
        from: "Bob",
        toMemberId: "a",
        to: "Alice",
        amount: 100,
        originalAmount: 125,
        paidAmount: 25,
        remainingAmount: 100,
        items: [],
      },
      {
        fromMemberId: "c",
        from: "Charlie",
        toMemberId: "a",
        to: "Alice",
        amount: 50,
        originalAmount: 50,
        paidAmount: 0,
        remainingAmount: 50,
        items: [],
      },
    ];

    const groups = calculatePersonSettlementGroups(
      [alice, bob, charlie],
      breakdowns
    );

    const aliceGroup = groups.find((g) => g.memberId === "a");
    expect(aliceGroup?.incoming).toHaveLength(2);
    expect(aliceGroup?.totalToReceive).toBe(150);
    expect(aliceGroup?.totalPaidToMember).toBe(25);
    expect(aliceGroup?.outgoing).toHaveLength(0);
    expect(aliceGroup?.totalToPay).toBe(0);

    const bobGroup = groups.find((g) => g.memberId === "b");
    expect(bobGroup?.outgoing).toHaveLength(1);
    expect(bobGroup?.totalToPay).toBe(100);
    expect(bobGroup?.totalPaidByMember).toBe(25);
  });
});
