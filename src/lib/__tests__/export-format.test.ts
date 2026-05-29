import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildClientExportJSON, buildClientExportCSV, downloadFile } from "../export-format";

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

  it("escapes commas, quotes, and newlines across exported fields", () => {
    const tripWithSpecialChars = {
      ...mockTrip,
      expenses: [
        {
          ...mockTrip.expenses[0],
          description: 'Taxi, "late night"',
          paidBy: { name: "Alice, Jr." },
          splitType: "custom\nplan",
          note: 'Gate A\nAsk for "receipt"',
        },
      ],
    };

    const csv = buildClientExportCSV(tripWithSpecialChars);

    expect(csv).toContain('"Taxi, ""late night"""');
    expect(csv).toContain('"Alice, Jr."');
    expect(csv).toContain('"custom\nplan"');
    expect(csv).toContain('"Gate A\nAsk for ""receipt"""');
  });
});

describe("downloadFile", () => {
  const createObjectURL = vi.fn(() => "blob:mock-url");
  const revokeObjectURL = vi.fn();
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    clickSpy.mockClear();
  });

  it("appends a temporary download link and revokes the object URL after the click", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    downloadFile("hello", "report.txt", "text/plain");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
