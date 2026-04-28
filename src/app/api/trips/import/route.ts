import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordSideEffects } from "@/lib/side-effects";
import { generateInviteCode, getAvailableName } from "@/lib/utils";
import { formatZodErrors, importTripSchema } from "@/lib/validations";

type ImportPayload = z.infer<typeof importTripSchema>;

export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json();
  const parsed = importTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const payload: ImportPayload = parsed.data;

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

  await recordSideEffects({
    tripId: restoredTrip.id,
    userId: user.id,
    activity: {
      action: "backup_imported",
      targetType: "trip",
      targetId: restoredTrip.id,
      details: `${payload.trip.name || restoredTrip.name} 已從備份還原`,
    },
    notification: {
      actorUserId: user.id,
      type: "backup_imported",
      title: "旅程已從備份還原",
      message: `${user.name} 匯入了備份並建立「${restoredTrip.name}」`,
    },
  });

  return NextResponse.json(restoredTrip, { status: 201 });
}
