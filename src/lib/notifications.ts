import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_TYPE_TO_PREFERENCE,
  type NotificationPreferenceField,
} from "@/lib/constants";
import { pushText } from "@/lib/line/push";
import { NOTIFICATION_TYPE_TO_LINE_PUSH, buildPushMessage } from "@/lib/notifications/messages";

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

    const linePushType = NOTIFICATION_TYPE_TO_LINE_PUSH[params.type];
    if (linePushType) {
      const usersWithPush = await prisma.user.findMany({
        where: {
          id: { in: filteredRecipients },
          linePushEnabled: true,
        },
        select: { id: true, lineUserId: true },
      });

      const pushText_ = buildPushMessage(params.type, params.title, params.message);

      await Promise.allSettled(
        usersWithPush.map(async (user) => {
          try {
            const result = await pushText(user.lineUserId, pushText_);
            if (!result.delivered) {
              console.warn("LINE push not delivered", { userId: user.id, reason: result.reason });
            }
          } catch (err) {
            console.warn("LINE push failed", { userId: user.id, error: err instanceof Error ? err.message : String(err) });
          }
        })
      );
    }
  } catch (error) {
    console.error("Failed to create trip notifications", {
      tripId: params.tripId,
      type: params.type,
      error,
    });
  }
}
