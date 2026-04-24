import { prisma } from "@/lib/prisma";

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

  await prisma.notification.createMany({
    data: Array.from(recipientIds).map((userId) => ({
      userId,
      tripId: params.tripId,
      type: params.type,
      title: params.title,
      message: params.message,
    })),
  });
}
