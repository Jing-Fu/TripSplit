import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json();
  const {
    amount,
    currency,
    exchangeRate,
    category,
    description,
    note,
    date,
    paidById,
    splitType,
    splits,
    receiptUrl,
  } = body;

  if (!amount || !category || !description || !date || !paidById) {
    return NextResponse.json({ error: "缺少必填欄位" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { members: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  const creatorMember = trip.members.find((member) => member.userId === user.id) ?? null;

  if (!creatorMember && trip.ownerId !== user.id) {
    return forbidden("只有旅程成員才能新增費用");
  }

  const paidByMember = trip.members.find((member) => member.id === paidById);

  if (!paidByMember) {
    return NextResponse.json({ error: "付款人不屬於此旅程" }, { status: 400 });
  }

  if (trip.ownerId !== user.id && paidByMember.userId !== user.id) {
    return forbidden("你只能以自己的身份建立費用，除非你是旅程建立者");
  }

  const splitPayload = Array.isArray(splits) ? splits : [];
  const validSplitMemberIds = new Set(trip.members.map((member) => member.id));

  if (
    splitPayload.some(
      (split: { memberId: string; amount: number }) =>
        !validSplitMemberIds.has(split.memberId)
    )
  ) {
    return NextResponse.json({ error: "分攤對象必須是旅程成員" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      amount: parseFloat(amount),
      currency: currency || "TWD",
      exchangeRate: exchangeRate ? parseFloat(exchangeRate) : 1.0,
      category,
      description,
      note,
      date: new Date(date),
      paidById,
      tripId: params.tripId,
      splitType: splitType || "equal",
      receiptUrl: receiptUrl || null,
      createdById: user.id,
      splits: {
        create: splitPayload.map((split: { memberId: string; amount: number }) => ({
          memberId: split.memberId,
          amount: split.amount,
        })),
      },
    },
    include: {
      paidBy: { include: { user: true } },
      createdBy: true,
      splits: { include: { member: { include: { user: true } } } },
    },
  });

  await logActivity({
    tripId: params.tripId,
    userId: user.id,
    action: "expense_created",
    targetType: "expense",
    targetId: expense.id,
    details: `${expense.description} ${expense.amount} ${expense.currency}`,
  });

  return NextResponse.json(expense, { status: 201 });
}
