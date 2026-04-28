import { logActivity, type ActivityAction } from "./activity";
import { createNotificationsForTrip } from "./notifications";

export async function recordSideEffects(params: {
  tripId: string;
  userId: string;
  activity: {
    action: ActivityAction;
    targetType: "expense" | "payment" | "member" | "trip" | "notification";
    targetId?: string;
    details?: string;
  };
  notification: {
    actorUserId: string;
    type: string;
    title: string;
    message: string;
  };
}): Promise<void> {
  await Promise.all([
    logActivity({
      tripId: params.tripId,
      userId: params.userId,
      ...params.activity,
    }),
    createNotificationsForTrip({
      tripId: params.tripId,
      ...params.notification,
    }),
  ]);
}
