import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  trip: {
    findUnique: vi.fn(),
  },
  settlementPayment: {
    create: vi.fn(),
  },
}));
const recordSideEffects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser,
  forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/side-effects", () => ({ recordSideEffects }));

import { POST } from "@/app/api/trips/[tripId]/payments/route";

const user = { id: "user-1", name: "Alice" };
const alice = { id: "member-1", name: "Alice", userId: user.id };
const bob = { id: "member-2", name: "Bob", userId: "user-2" };
const carol = { id: "member-3", name: "Carol", userId: "user-3" };

function paymentRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips/[tripId]/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user, error: null });
  });

  it("prevents non-owners from marking another member's outgoing payment", async () => {
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "owner-1",
      currency: "TWD",
      members: [alice, bob, carol],
    });

    const response = await POST(
      paymentRequest({
        fromMemberId: bob.id,
        toMemberId: carol.id,
        amount: 100,
      }),
      { params: Promise.resolve({ tripId: "trip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "只有付款本人或旅程建立者可以標記付款" });
    expect(prisma.settlementPayment.create).not.toHaveBeenCalled();
  });
});
