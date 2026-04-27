import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/prisma-json";
import { forbidden, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";
import { createPaymentSchema, formatZodErrors } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { members: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  const currentMember = trip.members.find((member) => member.userId === user.id) ?? null;
  if (!currentMember && trip.ownerId !== user.id) {
    return forbidden("只有旅程成員可以標記付款狀態");
  }

  const body = await request.json();
  const { fromMemberId, toMemberId, amount, note } = body;

  const result = createPaymentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: formatZodErrors(result.error) },
      { status: 400 }
    );
  }

  const validMemberIds = new Set(trip.members.map((member) => member.id));
  if (!validMemberIds.has(result.data.fromMemberId) || !validMemberIds.has(result.data.toMemberId)) {
    return NextResponse.json({ error: "付款雙方必須屬於此旅程" }, { status: 400 });
  }

  const payment = await prisma.settlementPayment.create({
    data: {
      tripId: params.tripId,
      fromMemberId: result.data.fromMemberId,
      toMemberId: result.data.toMemberId,
      amount: result.data.amount,
      currency: trip.currency,
      note: result.data.note,
      settledById: user.id,
    },
    include: {
      fromMember: true,
      toMember: true,
      settledBy: true,
    },
  });

  await logActivity({
    tripId: params.tripId,
    userId: user.id,
    action: "payment_marked",
    targetType: "payment",
    targetId: payment.id,
    details: `${payment.fromMember.name} → ${payment.toMember.name} ${payment.amount} ${payment.currency}`,
  });

  await createNotificationsForTrip({
    tripId: params.tripId,
    actorUserId: user.id,
    type: "payment_marked",
    title: "新增付款紀錄",
    message: `${payment.fromMember.name} → ${payment.toMember.name} ${payment.amount} ${payment.currency}`,
  });

  return NextResponse.json(serializePrisma(payment), { status: 201 });
}
