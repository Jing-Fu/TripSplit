import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  trip: {
    findUnique: vi.fn(),
  },
  notificationPreference: {
    findMany: vi.fn(),
  },
  notification: {
    createMany: vi.fn(),
  },
}));

const pushText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/line/push", () => ({ pushText }));

import { createNotificationsForTrip } from "@/lib/notifications";

describe("createNotificationsForTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notification.createMany.mockResolvedValue({ count: 0 });
  });

  it("creates in-app notifications for the actor and other trip users", async () => {
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "user-1",
      owner: { id: "user-1" },
      members: [
        { id: "member-1", userId: "user-1" },
        { id: "member-2", userId: "user-2" },
      ],
    });

    await createNotificationsForTrip({
      tripId: "trip-1",
      actorUserId: "user-1",
      type: "expense_created",
      title: "Expense added",
      message: "Alice added lunch",
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "user-1", type: "expense_created" }),
        expect.objectContaining({ userId: "user-2", type: "expense_created" }),
      ]),
    });
    expect(prisma.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("does not send LINE push for regular in-app notifications", async () => {
    prisma.trip.findUnique.mockResolvedValue({
      id: "trip-1",
      ownerId: "user-1",
      owner: { id: "user-1" },
      members: [{ id: "member-1", userId: "user-1" }],
    });

    await createNotificationsForTrip({
      tripId: "trip-1",
      actorUserId: "user-1",
      type: "payment_marked",
      title: "Payment recorded",
      message: "Alice paid Bob",
    });

    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
    expect(pushText).not.toHaveBeenCalled();
  });
});
