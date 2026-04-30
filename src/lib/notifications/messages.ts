export const LINE_PUSH_NOTIFICATION_TYPES = [
  "trip-add",
  "new-expense",
  "payment-status-change",
  "settlement-reminder",
] as const;

export type LinePushNotificationType = typeof LINE_PUSH_NOTIFICATION_TYPES[number];

export const NOTIFICATION_TYPE_TO_LINE_PUSH: Record<string, LinePushNotificationType | undefined> = {
  member_added: "trip-add",
  expense_created: "new-expense",
  payment_marked: "payment-status-change",
  payment_updated: "payment-status-change",
  settlement_reminder: "settlement-reminder",
};

export function buildPushMessage(type: string, title: string, message: string): string {
  return `${title}\n${message}`;
}
