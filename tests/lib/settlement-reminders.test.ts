import { describe, it, expect, vi, beforeEach } from "vitest";

const reminderCreate = vi.hoisted(() => vi.fn());
const pushText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    settlementReminder: {
      create: reminderCreate,
    },
  },
}));

vi.mock("@/lib/line/push", () => ({
  pushText,
}));

import { buildReminderGroups, sendSettlementReminders } from "@/lib/settlement-reminders";

describe("settlement reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds one reminder group per debtor user for a trip", () => {
    const groups = buildReminderGroups(buildTrip());

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      tripId: "trip-1",
      userId: "user-1",
      lineUserId: "U_test_user_001",
      tripName: "東京旅行",
      payments: [
        { fromName: "小明", toName: "阿宏", amount: 250, currency: "TWD" },
        { fromName: "小明", toName: "小美", amount: 100, currency: "TWD" },
      ],
    });
  });

  it("claims the user-trip reminder before sending one LINE summary", async () => {
    reminderCreate.mockResolvedValue({ id: "reminder-1" });
    pushText.mockResolvedValue({ delivered: true });

    const result = await sendSettlementReminders(buildTrip());

    expect(reminderCreate).toHaveBeenCalledWith({
      data: { tripId: "trip-1", userId: "user-1" },
    });
    expect(pushText).toHaveBeenCalledTimes(1);
    expect(pushText).toHaveBeenCalledWith(
      "U_test_user_001",
      [
        "提醒：你在「東京旅行」有 2 筆待付款尚未完成。",
        "- 小明 → 阿宏: 250.00 TWD",
        "- 小明 → 小美: 100.00 TWD",
        "請盡快處理。",
      ].join("\n")
    );
    expect(result).toEqual({ attempted: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("skips users that already have a reminder for the trip", async () => {
    const result = await sendSettlementReminders(
      buildTrip({ settlementReminders: [{ userId: "user-1" }] })
    );

    expect(reminderCreate).not.toHaveBeenCalled();
    expect(pushText).not.toHaveBeenCalled();
    expect(result).toEqual({ attempted: 0, sent: 0, failed: 0, skipped: 0 });
  });
});

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildMember(id: string, name: string, userId: string, lineUserId: string) {
  return {
    id,
    name,
    userId,
    user: {
      id: userId,
      lineUserId,
      linePushEnabled: true,
    },
  };
}

function buildExpense(
  id: string,
  paidById: string,
  splits: Array<[memberId: string, amount: number]>
) {
  const members = new Map([
    ["member-1", { id: "member-1", name: "小明" }],
    ["member-2", { id: "member-2", name: "小美" }],
    ["member-3", { id: "member-3", name: "阿宏" }],
  ]);
  const paidBy = members.get(paidById)!;

  return {
    id,
    amount: decimal(splits.reduce((sum, [, amount]) => sum + amount, 0)),
    currency: "TWD",
    exchangeRate: decimal(1),
    category: "other",
    description: id,
    note: null,
    settlementMode: "normal",
    settlementNote: null,
    date: new Date("2026-04-20T00:00:00.000Z"),
    paidBy,
    splits: splits.map(([memberId, amount], index) => ({
      id: `${id}-split-${index}`,
      amount: decimal(amount),
      member: members.get(memberId)!,
    })),
  };
}

function buildTrip(overrides: { settlementReminders?: Array<{ userId: string }> } = {}) {
  return {
    id: "trip-1",
    name: "東京旅行",
    currency: "TWD",
    ownerId: "owner-1",
    settlementReminders: overrides.settlementReminders ?? [],
    members: [
      buildMember("member-1", "小明", "user-1", "U_test_user_001"),
      buildMember("member-2", "小美", "user-2", "U_test_user_002"),
      buildMember("member-3", "阿宏", "user-3", "U_test_user_003"),
    ],
    expenses: [
      buildExpense("expense-1", "member-2", [
        ["member-1", 100],
        ["member-2", 0],
      ]),
      buildExpense("expense-2", "member-3", [
        ["member-1", 250],
        ["member-3", 0],
      ]),
    ],
    payments: [],
  };
}
