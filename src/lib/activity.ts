import { prisma } from "./prisma";

export type ActivityAction =
  | "expense_created"
  | "expense_updated"
  | "expense_deleted"
  | "payment_marked"
  | "payment_updated"
  | "member_added"
  | "member_removed"
  | "backup_imported"
  | "backup_exported"
  | "notion_exported"
  | "notification_generated";

export async function logActivity(params: {
  tripId: string;
  userId: string;
  action: ActivityAction;
  targetType: "expense" | "payment" | "member" | "trip" | "notification";
  targetId?: string;
  details?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        tripId: params.tripId,
        userId: params.userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId || null,
        details: params.details || null,
      },
    });
  } catch {
    // Non-critical — don't fail the main operation
  }
}
