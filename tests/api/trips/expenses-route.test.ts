import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const deleteObject = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  expense: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  trip: {
    findUnique: vi.fn(),
  },
  split: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const recordSideEffects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser,
  forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

vi.mock("@/lib/side-effects", () => ({ recordSideEffects }));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, deleteObject };
});

import { PATCH, DELETE } from "@/app/api/trips/[tripId]/expenses/[expenseId]/route";
import { POST } from "@/app/api/trips/[tripId]/expenses/route";

const user = { id: "user-1", name: "Alice" };
const member = { id: "member-1", name: "Alice", userId: user.id };

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validExpenseBody = {
  amount: 100,
  currency: "TWD",
  exchangeRate: 1,
  category: "food",
  description: "Dinner",
  date: "2026-05-01",
  paidById: member.id,
  splitType: "equal",
  splits: [{ memberId: member.id, amount: 100 }],
};

describe("expense receipt storage boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user, error: null });
  });

  it("rejects receipt keys outside the current user's upload prefix on create", async () => {
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "owner-1",
      members: [member],
    });

    const response = await POST(
      jsonRequest("http://localhost/api/trips/trip-1/expenses", {
        ...validExpenseBody,
        receiptKey: "uploads/another-user/receipt.jpg",
      }),
      { params: Promise.resolve({ tripId: "trip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "收據檔案不屬於目前使用者" });
    expect(prisma.expense.delete).not.toHaveBeenCalled();
  });

  it("rejects expense splits that do not add up to the expense amount on create", async () => {
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "owner-1",
      members: [member],
    });

    const response = await POST(
      jsonRequest("http://localhost/api/trips/trip-1/expenses", {
        ...validExpenseBody,
        splits: [{ memberId: member.id, amount: 99.99 }],
      }),
      { params: Promise.resolve({ tripId: "trip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("分攤金額合計需等於費用金額");
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("returns not found when the expense does not belong to the route trip on patch", async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: "expense-1",
      tripId: "trip-a",
      paidById: member.id,
      createdById: user.id,
      receiptKey: null,
      trip: { id: "trip-a", ownerId: "owner-1" },
      paidBy: member,
    });

    const response = await PATCH(
      jsonRequest("http://localhost/api/trips/trip-b/expenses/expense-1", {
        description: "Updated",
      }),
      { params: Promise.resolve({ tripId: "trip-b", expenseId: "expense-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "費用不存在" });
    expect(prisma.trip.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps existing splits when patching fields without a splits payload", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "expense-1",
      description: "Updated",
      amount: 100,
      currency: "TWD",
      paidBy: member,
      createdBy: user,
      splits: [{ id: "split-1", member }],
    });
    const tx = {
      split: { deleteMany: vi.fn() },
      expense: { update },
    };
    prisma.expense.findUnique.mockResolvedValue({
      id: "expense-1",
      tripId: "trip-1",
      paidById: member.id,
      createdById: user.id,
      amount: 100,
      receiptKey: null,
      splits: [{ id: "split-1", memberId: member.id, amount: 100 }],
      trip: { id: "trip-1", ownerId: "owner-1" },
      paidBy: member,
    });
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "owner-1",
      members: [member],
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    recordSideEffects.mockResolvedValue(undefined);

    const response = await PATCH(
      jsonRequest("http://localhost/api/trips/trip-1/expenses/expense-1", {
        description: "Updated",
      }),
      { params: Promise.resolve({ tripId: "trip-1", expenseId: "expense-1" }) }
    );

    expect(response.status).toBe(200);
    expect(tx.split.deleteMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ splits: expect.anything() }),
      })
    );
  });

  it("rejects amount updates that would leave existing splits inconsistent", async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: "expense-1",
      tripId: "trip-1",
      paidById: member.id,
      createdById: user.id,
      amount: 100,
      receiptKey: null,
      splits: [{ id: "split-1", memberId: member.id, amount: 100 }],
      trip: { id: "trip-1", ownerId: "owner-1" },
      paidBy: member,
    });
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "owner-1",
      members: [member],
    });

    const response = await PATCH(
      jsonRequest("http://localhost/api/trips/trip-1/expenses/expense-1", {
        amount: 120,
      }),
      { params: Promise.resolve({ tripId: "trip-1", expenseId: "expense-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("分攤金額合計需等於費用金額");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns not found when the expense does not belong to the route trip on delete", async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: "expense-1",
      tripId: "trip-a",
      paidById: member.id,
      createdById: user.id,
      receiptKey: `uploads/${user.id}/receipt.jpg`,
      description: "Dinner",
      trip: { id: "trip-a", ownerId: "owner-1" },
      paidBy: member,
    });

    const response = await DELETE(
      new Request("http://localhost/api/trips/trip-b/expenses/expense-1", { method: "DELETE" }),
      { params: Promise.resolve({ tripId: "trip-b", expenseId: "expense-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "費用不存在" });
    expect(prisma.expense.delete).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("does not delete legacy non-receipt storage keys during expense delete", async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: "expense-1",
      tripId: "trip-1",
      paidById: member.id,
      createdById: user.id,
      receiptKey: "backups/trip-1.json",
      description: "Dinner",
      trip: { id: "trip-1", ownerId: "owner-1" },
      paidBy: member,
    });
    prisma.expense.delete.mockResolvedValue({});
    recordSideEffects.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/trips/trip-1/expenses/expense-1", { method: "DELETE" }),
      { params: Promise.resolve({ tripId: "trip-1", expenseId: "expense-1" }) }
    );

    expect(response.status).toBe(200);
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: "expense-1" } });
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
