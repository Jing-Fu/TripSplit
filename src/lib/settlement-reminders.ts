import { Prisma } from "@prisma/client";
import { pushText } from "@/lib/line/push";
import { prisma } from "@/lib/prisma";
import { calculateSuggestedSettlements } from "@/lib/settlement";

const MAX_DETAIL_LINES = 10;

interface DecimalLike {
  toNumber(): number;
}

interface SettlementReminderTrip {
  id: string;
  name: string;
  currency: string;
  members: Array<{
    id: string;
    name: string;
    userId?: string | null;
    user?: {
      id: string;
      lineUserId: string;
      linePushEnabled: boolean;
    } | null;
  }>;
  expenses: Array<{
    id: string;
    amount: DecimalLike;
    currency: string;
    exchangeRate: DecimalLike;
    category: string;
    description: string;
    note?: string | null;
    settlementMode?: string;
    settlementNote?: string | null;
    date: Date;
    paidBy: { id: string; name: string; userId?: string | null };
    splits: Array<{
      id: string;
      amount: DecimalLike;
      member: { id: string; name: string; userId?: string | null };
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: DecimalLike;
    currency: string;
    note: string | null;
    status: string;
    settledAt: Date;
    fromMember: { id: string; name: string; userId?: string | null };
    toMember: { id: string; name: string; userId?: string | null };
  }>;
  settlementReminders: Array<{ userId: string }>;
}

interface ReminderGroup {
  tripId: string;
  userId: string;
  lineUserId: string;
  tripName: string;
  payments: Array<{
    fromName: string;
    toName: string;
    amount: number;
    currency: string;
  }>;
}

export interface SettlementReminderResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function getTripForReminder(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: {
          paidBy: true,
          splits: { include: { member: true } },
        },
      },
      payments: {
        include: {
          fromMember: true,
          toMember: true,
        },
      },
      settlementReminders: true,
    },
  });
}

export function buildReminderGroups(trip: SettlementReminderTrip): ReminderGroup[] {
  const remindedUserIds = new Set(trip.settlementReminders.map((reminder) => reminder.userId));
  const membersById = new Map(trip.members.map((member) => [member.id, member]));
  const groupByUserId = new Map<string, ReminderGroup>();

  const settlements = calculateSuggestedSettlements(
    trip.members,
    trip.expenses.map((expense) => ({
      ...expense,
      amount: expense.amount.toNumber(),
      exchangeRate: expense.exchangeRate.toNumber(),
      date: expense.date.toISOString(),
      splits: expense.splits.map((split) => ({
        ...split,
        amount: split.amount.toNumber(),
      })),
    })),
    trip.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toNumber(),
      settledAt: payment.settledAt.toISOString(),
    }))
  );

  for (const settlement of settlements) {
    const fromMember = membersById.get(settlement.fromMemberId);
    const user = fromMember?.user;
    if (!user?.linePushEnabled || remindedUserIds.has(user.id)) continue;

    const group = groupByUserId.get(user.id) ?? {
      tripId: trip.id,
      userId: user.id,
      lineUserId: user.lineUserId,
      tripName: trip.name,
      payments: [],
    };

    group.payments.push({
      fromName: settlement.from,
      toName: settlement.to,
      amount: settlement.amount,
      currency: trip.currency,
    });
    groupByUserId.set(user.id, group);
  }

  return Array.from(groupByUserId.values());
}

export function buildReminderMessage(group: ReminderGroup) {
  const visiblePayments = group.payments.slice(0, MAX_DETAIL_LINES);
  const lines = visiblePayments.map(
    (payment) => `- ${payment.fromName} → ${payment.toName}: ${payment.amount.toFixed(2)} ${payment.currency}`
  );
  const hiddenCount = group.payments.length - visiblePayments.length;

  if (hiddenCount > 0) {
    lines.push(`另有 ${hiddenCount} 筆待付款，請進入 TripSplit 查看完整結算。`);
  }

  return [
    `提醒：你在「${group.tripName}」有 ${group.payments.length} 筆待付款尚未完成。`,
    ...lines,
    "請盡快處理。",
  ].join("\n");
}

async function claimReminder(group: ReminderGroup) {
  try {
    await prisma.settlementReminder.create({
      data: {
        tripId: group.tripId,
        userId: group.userId,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }

    throw error;
  }
}

export async function sendSettlementReminders(trip: SettlementReminderTrip): Promise<SettlementReminderResult> {
  const groups = buildReminderGroups(trip);
  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const group of groups) {
    const claimed = await claimReminder(group);
    if (!claimed) {
      skipped++;
      continue;
    }

    attempted++;
    try {
      const result = await pushText(group.lineUserId, buildReminderMessage(group));
      if (result.delivered) {
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { attempted, sent, failed, skipped };
}
