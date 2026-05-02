import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const getSignedReadUrl = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  trip: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser,
  forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, getSignedReadUrl };
});

import { GET } from "@/app/api/trips/[tripId]/route";

const user = { id: "user-1", name: "Alice" };

const baseTrip = {
  id: "trip-1",
  ownerId: user.id,
  owner: user,
  members: [{ id: "member-1", name: "Alice", userId: user.id, user }],
  payments: [],
};

describe("GET /api/trips/[tripId] receipt URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user, error: null });
  });

  it("does not sign legacy non-receipt storage keys", async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      expenses: [
        {
          id: "expense-1",
          amount: 100,
          exchangeRate: 1,
          receiptKey: "backups/trip-1.json",
          paidBy: { id: "member-1", name: "Alice", user },
          createdBy: user,
          splits: [],
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/trips/trip-1"), {
      params: Promise.resolve({ tripId: "trip-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.expenses[0].receiptUrl).toBeNull();
    expect(getSignedReadUrl).not.toHaveBeenCalled();
  });
});
