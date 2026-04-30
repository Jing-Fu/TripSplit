import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const getTripForReminder = vi.hoisted(() => vi.fn());
const sendSettlementReminders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser,
  forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/settlement-reminders", () => ({
  getTripForReminder,
  sendSettlementReminders,
}));

import { POST } from "@/app/api/trips/[tripId]/settlement-reminder/route";

const user = { id: "user-owner", name: "Owner" };

function makeRequest() {
  return new Request("http://localhost/api/trips/trip-1/settlement-reminder", {
    method: "POST",
  });
}

describe("POST /api/trips/[tripId]/settlement-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    requireUser.mockResolvedValue({ user, error: null });
  });

  it("requires LINE push configuration before claiming reminders", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const response = await POST(makeRequest(), { params: { tripId: "trip-1" } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "LINE 推播尚未設定" });
    expect(getTripForReminder).not.toHaveBeenCalled();
    expect(sendSettlementReminders).not.toHaveBeenCalled();
  });

  it("only allows the trip owner to complete settlement reminders", async () => {
    getTripForReminder.mockResolvedValue({ id: "trip-1", ownerId: "another-user" });

    const response = await POST(makeRequest(), { params: { tripId: "trip-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "只有旅程建立者可以完成結算並推播提醒" });
    expect(sendSettlementReminders).not.toHaveBeenCalled();
  });

  it("sends one settlement reminder batch for the owner-triggered trip", async () => {
    const trip = { id: "trip-1", ownerId: user.id };
    getTripForReminder.mockResolvedValue(trip);
    sendSettlementReminders.mockResolvedValue({ attempted: 2, sent: 2, failed: 0, skipped: 0 });

    const response = await POST(makeRequest(), { params: { tripId: "trip-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getTripForReminder).toHaveBeenCalledWith("trip-1");
    expect(sendSettlementReminders).toHaveBeenCalledWith(trip);
    expect(body).toEqual({ ok: true, attempted: 2, sent: 2, failed: 0, skipped: 0 });
  });
});
