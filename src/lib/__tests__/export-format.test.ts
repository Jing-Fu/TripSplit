import { describe, expect, it } from "vitest";
import { buildClientExportJSON, buildClientExportCSV } from "../export-format";

const mockTrip = {
  name: "Tokyo Trip",
  description: "Fun trip",
  destination: "Tokyo",
  startDate: "2025-06-01",
  endDate: "2025-06-10",
  currency: "JPY",
  coverEmoji: "🇯🇵",
  members: [{ name: "Alice" }, { name: "Bob" }],
  expenses: [
    {
      description: "Ramen",
      amount: 1500,
      currency: "JPY",
      exchangeRate: 1,
      category: "food",
      date: "2025-06-02",
      paidBy: { name: "Alice" },
      splitType: "equal",
      note: null,
      settlementMode: "normal",
      settlementNote: null,
      splits: [
        { member: { name: "Alice" }, amount: 750 },
        { member: { name: "Bob" }, amount: 750 },
      ],
    },
  ],
  payments: [
    {
      fromMember: { name: "Bob" },
      toMember: { name: "Alice" },
      amount: 750,
      currency: "JPY",
      status: "completed",
      settledAt: "2025-06-05",
      note: null,
    },
  ],
};

describe("buildClientExportJSON", () => {
  it("produces correct structure", () => {
    const result = buildClientExportJSON(mockTrip);

    expect(result.exportedAt).toBeDefined();
    expect(result.trip.name).toBe("Tokyo Trip");
    expect(result.trip.currency).toBe("JPY");
    expect(result.members).toHaveLength(2);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].paidBy).toBe("Alice");
    expect(result.expenses[0].splits).toHaveLength(2);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].from).toBe("Bob");
    expect(result.payments[0].to).toBe("Alice");
  });
});

describe("buildClientExportCSV", () => {
  it("produces CSV with BOM and correct headers", () => {
    const csv = buildClientExportCSV(mockTrip);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("日期,說明,金額,幣別,匯率,等值金額,類別,付款人,分帳方式,備註");
    expect(csv).toContain("Ramen");
    expect(csv).toContain("1500");
    expect(csv).toContain("餐飲");
  });

  it("uses custom category labels when provided", () => {
    const tripWithCustomCat = {
      ...mockTrip,
      expenses: [
        {
          ...mockTrip.expenses[0],
          category: "drinks",
        },
      ],
    };

    const csv = buildClientExportCSV(tripWithCustomCat, [
      { value: "drinks", label: "飲料", emoji: "🍺" },
    ]);

    expect(csv).toContain("飲料");
  });

  it("falls back to 其他 for unknown categories", () => {
    const tripWithUnknown = {
      ...mockTrip,
      expenses: [
        {
          ...mockTrip.expenses[0],
          category: "xyz_unknown",
        },
      ],
    };

    const csv = buildClientExportCSV(tripWithUnknown);
    expect(csv).toContain("其他");
  });
});
