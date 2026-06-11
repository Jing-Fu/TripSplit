import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const getTripForUser = vi.hoisted(() => vi.fn());
const buildTripExportJSON = vi.hoisted(() => vi.fn());
const uploadObject = vi.hoisted(() => vi.fn());
const recordSideEffects = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  backupRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser,
  forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/storage", () => ({ uploadObject }));
vi.mock("@/lib/side-effects", () => ({ recordSideEffects }));
vi.mock("@/lib/trip-export", () => ({
  getTripForUser,
  buildTripExportJSON,
}));

import { POST } from "@/app/api/trips/[tripId]/backup/route";

const user = { id: "user-1", name: "Alice" };

describe("POST /api/trips/[tripId]/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user, error: null });
  });

  it("only allows the trip owner to create server backups", async () => {
    getTripForUser.mockResolvedValue({
      id: "trip-1",
      name: "Tokyo",
      ownerId: "owner-1",
    });

    const response = await POST(
      new Request("http://localhost/api/trips/trip-1/backup", { method: "POST" }),
      { params: Promise.resolve({ tripId: "trip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "只有旅程建立者可以建立伺服器備份" });
    expect(buildTripExportJSON).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(prisma.backupRecord.create).not.toHaveBeenCalled();
  });
});
