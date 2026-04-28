import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_TYPE_TO_PREFERENCE,
  type NotificationPreferenceField,
} from "@/lib/constants";

export async function createNotificationsForTrip(params: {
  tripId: string;
  actorUserId: string;
  type: string;
  title: string;
  message: string;
}) {
  try {
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

    const prefKey =
      NOTIFICATION_TYPE_TO_PREFERENCE[
        params.type as keyof typeof NOTIFICATION_TYPE_TO_PREFERENCE
      ];
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

        return pref[prefKey as NotificationPreferenceField] !== false;
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
  } catch (error) {
    console.error("Failed to create trip notifications", {
      tripId: params.tripId,
      type: params.type,
      error,
    });
  }
}
