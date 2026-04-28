import { describe, expect, it } from "vitest";
import {
  createExpenseSchema,
  createTripSchema,
  createPaymentSchema,
  updateTripSchema,
  updatePaymentStatusSchema,
  joinTripSchema,
  createCategorySchema,
  updateCategorySchema,
  importTripSchema,
  formatZodErrors,
} from "../validations";

describe("createExpenseSchema", () => {
  const valid = {
    amount: "100",
    currency: "TWD",
    category: "food",
    description: "lunch",
    date: "2025-01-01",
    paidById: "member-1",
    splits: [{ memberId: "member-1", amount: "100" }],
  };

  it("parses valid input with coercion", () => {
    const result = createExpenseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
      expect(result.data.splits[0].amount).toBe(100);
    }
  });

  it("rejects zero amount", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = createExpenseSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(false);
  });

  it("allows nonnegative split amount", () => {
    const result = createExpenseSchema.safeParse({
      ...valid,
      splits: [{ memberId: "m1", amount: "0" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("createTripSchema", () => {
  it("parses valid trip data", () => {
    const result = createTripSchema.safeParse({
      name: "Tokyo Trip",
      startDate: "2025-06-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("TWD");
      expect(result.data.coverEmoji).toBe("✈️");
    }
  });

  it("rejects missing name", () => {
    const result = createTripSchema.safeParse({
      name: "",
      startDate: "2025-06-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTripSchema", () => {
  it("allows partial updates", () => {
    const result = updateTripSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("allows empty object", () => {
    const result = updateTripSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("updatePaymentStatusSchema", () => {
  it("accepts completed", () => {
    const result = updatePaymentStatusSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });

  it("accepts cancelled", () => {
    const result = updatePaymentStatusSchema.safeParse({ status: "cancelled" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updatePaymentStatusSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });
});

describe("joinTripSchema", () => {
  it("accepts valid invite code", () => {
    const result = joinTripSchema.safeParse({ inviteCode: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty invite code", () => {
    const result = joinTripSchema.safeParse({ inviteCode: "" });
    expect(result.success).toBe(false);
  });
});

describe("createCategorySchema", () => {
  it("parses valid category", () => {
    const result = createCategorySchema.safeParse({
      value: "drinks",
      label: "飲料",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing value", () => {
    const result = createCategorySchema.safeParse({
      value: "",
      label: "飲料",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts label update", () => {
    const result = updateCategorySchema.safeParse({ label: "新名稱" });
    expect(result.success).toBe(true);
  });

  it("accepts emoji update", () => {
    const result = updateCategorySchema.safeParse({ emoji: "🍺" });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("importTripSchema", () => {
  it("parses minimal valid import", () => {
    const result = importTripSchema.safeParse({
      trip: { name: "My Trip", startDate: "2025-01-01" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing trip name", () => {
    const result = importTripSchema.safeParse({
      trip: { name: "", startDate: "2025-01-01" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing start date", () => {
    const result = importTripSchema.safeParse({
      trip: { name: "Trip", startDate: "" },
    });
    expect(result.success).toBe(false);
  });

  it("parses full import with all arrays", () => {
    const result = importTripSchema.safeParse({
      trip: { name: "Trip", startDate: "2025-01-01", currency: "USD" },
      members: [{ name: "Alice" }, { name: "Bob" }],
      expenses: [
        {
          description: "Lunch",
          amount: 50,
          date: "2025-01-02",
          paidBy: "Alice",
          splits: [{ member: "Alice", amount: 25 }, { member: "Bob", amount: 25 }],
        },
      ],
      payments: [
        { from: "Bob", to: "Alice", amount: 25 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("formatZodErrors", () => {
  it("joins multiple error messages", () => {
    const result = createExpenseSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain("、");
    }
  });
});
