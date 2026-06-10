import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const getCurrentUser = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  member: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  trip: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
  requireUser,
  unauthorized: (message = "請先登入") => NextResponse.json({ error: message }, { status: 401 }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { GET, POST } from "@/app/api/member-claims/[claimToken]/route";

describe("/api/member-claims/[claimToken]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
  });

  it("returns claim details for an unclaimed member", async () => {
    getCurrentUser.mockResolvedValue(null);
    prisma.member.findUnique.mockResolvedValue({
      id: "member-1",
      name: "小明",
      userId: null,
      tripId: "trip-1",
      trip: {
        id: "trip-1",
        name: "東京自由行",
        coverEmoji: "✈️",
        members: [],
      },
    });

    const response = await GET(new Request("http://localhost/api/member-claims/token-1"), {
      params: Promise.resolve({ claimToken: "token-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.memberName).toBe("小明");
    expect(body.viewerAuthenticated).toBe(false);
    expect(body.claimed).toBe(false);
  });

  it("claims an unclaimed member for the signed-in user", async () => {
    requireUser.mockResolvedValue({ user: { id: "user-1", name: "Alice" }, error: null });
    prisma.member.findUnique.mockResolvedValue({
      id: "member-1",
      name: "小明",
      userId: null,
      tripId: "trip-1",
      trip: {
        id: "trip-1",
        ownerId: "owner-1",
        members: [{ id: "member-1", userId: null }],
      },
    });

    const response = await POST(new Request("http://localhost/api/member-claims/token-1", { method: "POST" }), {
      params: Promise.resolve({ claimToken: "token-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tripId).toBe("trip-1");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { userId: "user-1", claimToken: null },
    });
  });

  it("rejects claiming when the user already has a member in the trip", async () => {
    requireUser.mockResolvedValue({ user: { id: "user-1", name: "Alice" }, error: null });
    prisma.member.findUnique.mockResolvedValue({
      id: "member-1",
      name: "小明",
      userId: null,
      tripId: "trip-1",
      trip: {
        id: "trip-1",
        ownerId: "owner-1",
        members: [
          { id: "member-1", userId: null },
          { id: "member-2", userId: "user-1" },
        ],
      },
    });

    const response = await POST(new Request("http://localhost/api/member-claims/token-1", { method: "POST" }), {
      params: Promise.resolve({ claimToken: "token-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("已經加入");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
