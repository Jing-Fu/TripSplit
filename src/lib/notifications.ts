import { prisma } from "@/lib/prisma";

const TYPE_TO_PREFERENCE_KEY: Record<string, string> = {
  expense_created: "expenseCreated",
  expense_updated: "expenseUpdated",
  expense_deleted: "expenseDeleted",
  member_added: "memberAdded",
  member_removed: "memberRemoved",
  payment_marked: "paymentMarked",
  payment_updated: "paymentUpdated",
  backup_imported: "backupImported",
};

export async function createNotificationsForTrip(params: {
  tripId: string;
  actorUserId: string;
  type: string;
  title: string;
  message: string;
}) {
  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: {
      members: true,
      owner: true,
    },
  });

  if (!trip) return;

  const recipientIds = new Set<string>();

  if (trip.ownerId && trip.ownerId !== params.actorUserId) {
    recipientIds.add(trip.ownerId);
  }

  trip.members.forEach((member) => {
    if (member.userId && member.userId !== params.actorUserId) {
      recipientIds.add(member.userId);
    }
  });

  if (recipientIds.size === 0) {
    return;
  }

  const prefKey = TYPE_TO_PREFERENCE_KEY[params.type];
  let filteredRecipients = Array.from(recipientIds);

  if (prefKey) {
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: filteredRecipients },
      },
    });

    const prefMap = new Map(preferences.map((p) => [p.userId, p]));

    filteredRecipients = filteredRecipients.filter((userId) => {
      const pref = prefMap.get(userId);
      if (!pref) return true;
      return (pref as Record<string, unknown>)[prefKey] !== false;
    });
  }

  if (filteredRecipients.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: filteredRecipients.map((userId) => ({
      userId,
      tripId: params.tripId,
      type: params.type,
      title: params.title,
      message: params.message,
    })),
  });
}
