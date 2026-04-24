import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";
import { generateInviteCode, getAvailableName } from "@/lib/utils";

type ImportPayload = {
  trip?: {
    name?: string;
    description?: string | null;
    destination?: string | null;
    startDate?: string;
    endDate?: string | null;
    currency?: string;
    coverEmoji?: string;
  };
  members?: Array<{ name?: string }>;
  expenses?: Array<{
    description?: string;
    amount?: number;
    currency?: string;
    exchangeRate?: number;
    category?: string;
    date?: string;
    paidBy?: string;
    splitType?: string;
    note?: string | null;
    settlementMode?: string;
    settlementNote?: string | null;
    splits?: Array<{ member?: string; amount?: number }>;
  }>;
  payments?: Array<{
    from?: string;
    to?: string;
    amount?: number;
    currency?: string;
    status?: string;
    settledAt?: string;
    note?: string | null;
  }>;
};

export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const payload = (await request.json()) as ImportPayload;

  if (!payload.trip?.name || !payload.trip?.startDate) {
    return NextResponse.json({ error: "備份檔缺少旅程基本資料" }, { status: 400 });
  }

  const memberNames = Array.isArray(payload.members)
    ? payload.members.map((member) => member.name?.trim()).filter(Boolean) as string[]
    : [];

  const ownerMemberName = getAvailableName(user.name, memberNames);
  const normalizedMemberNames = [
    ownerMemberName,
    ...memberNames.filter((name) => name !== ownerMemberName),
  ];

  const restoredTrip = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        name: `${payload.trip?.name}（已還原）`,
        description: payload.trip?.description || null,
        destination: payload.trip?.destination || null,
        startDate: new Date(payload.trip?.startDate || new Date().toISOString()),
        endDate: payload.trip?.endDate ? new Date(payload.trip.endDate) : null,
        currency: payload.trip?.currency || "TWD",
        coverEmoji: payload.trip?.coverEmoji || "✈️",
        inviteCode: generateInviteCode(),
        ownerId: user.id,
        members: {
          create: normalizedMemberNames.map((name, index) => ({
            name,
            ...(index === 0 ? { userId: user.id } : {}),
          })),
        },
      },
      include: { members: true },
    });

    const memberMap = new Map(trip.members.map((member) => [member.name, member.id]));

    for (const expense of payload.expenses || []) {
      if (!expense.description || !expense.amount || !expense.date || !expense.paidBy) {
        continue;
      }

      const paidById = memberMap.get(expense.paidBy) || trip.members[0]?.id;
      if (!paidById) continue;

      await tx.expense.create({
        data: {
          tripId: trip.id,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency || trip.currency,
          exchangeRate: expense.exchangeRate || 1,
          category: expense.category || "other",
          note: expense.note || null,
          settlementMode: expense.settlementMode || "normal",
          settlementNote: expense.settlementNote || null,
          date: new Date(expense.date),
          paidById,
          splitType: expense.splitType || "equal",
          createdById: user.id,
          splits: {
            create: (expense.splits || [])
              .map((split) => {
                const memberId = split.member ? memberMap.get(split.member) : null;
                if (!memberId || typeof split.amount !== "number") return null;
                return { memberId, amount: split.amount };
              })
              .filter(Boolean) as Array<{ memberId: string; amount: number }>,
          },
        },
      });
    }

    for (const payment of payload.payments || []) {
      if (!payment.from || !payment.to || !payment.amount) {
        continue;
      }

      const fromMemberId = memberMap.get(payment.from);
      const toMemberId = memberMap.get(payment.to);
      if (!fromMemberId || !toMemberId) continue;

      await tx.settlementPayment.create({
        data: {
          tripId: trip.id,
          fromMemberId,
          toMemberId,
          amount: payment.amount,
          currency: payment.currency || trip.currency,
          status: payment.status || "completed",
          note: payment.note || null,
          settledAt: payment.settledAt ? new Date(payment.settledAt) : new Date(),
          settledById: user.id,
        },
      });
    }

    return trip;
  });

  await logActivity({
    tripId: restoredTrip.id,
    userId: user.id,
    action: "backup_imported",
    targetType: "trip",
    targetId: restoredTrip.id,
    details: `${payload.trip?.name || restoredTrip.name} 已從備份還原`,
  });

  await createNotificationsForTrip({
    tripId: restoredTrip.id,
    actorUserId: user.id,
    type: "backup_imported",
    title: "旅程已從備份還原",
    message: `${user.name} 匯入了備份並建立「${restoredTrip.name}」`,
  });

  return NextResponse.json(restoredTrip, { status: 201 });
}
