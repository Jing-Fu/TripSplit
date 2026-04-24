import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";

async function getCategoryForTrip(tripId: string, categoryId: string) {
  return prisma.customCategory.findFirst({
    where: {
      id: categoryId,
      tripId,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string; categoryId: string } }
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

  const isMember = trip.members.some((member) => member.userId === user.id);

  if (!isMember && trip.ownerId !== user.id) {
    return forbidden("只有旅程成員可以查看類別");
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以修改類別");
  }

  const category = await getCategoryForTrip(params.tripId, params.categoryId);

  if (!category) {
    return NextResponse.json({ error: "類別不存在" }, { status: 404 });
  }

  const body = await request.json();
  const label = body.label?.trim();
  const emoji = body.emoji?.trim();

  if (body.label !== undefined && !label) {
    return NextResponse.json({ error: "label 不能為空" }, { status: 400 });
  }

  if (body.emoji !== undefined && !emoji) {
    return NextResponse.json({ error: "emoji 不能為空" }, { status: 400 });
  }

  if (body.label === undefined && body.emoji === undefined) {
    return NextResponse.json({
      id: category.id,
      value: category.value,
      label: category.label,
      emoji: category.emoji,
    });
  }

  const updatedCategory = await prisma.customCategory.update({
    where: { id: params.categoryId },
    data: {
      ...(body.label !== undefined && { label }),
      ...(body.emoji !== undefined && { emoji }),
    },
    select: {
      id: true,
      value: true,
      label: true,
      emoji: true,
    },
  });

  return NextResponse.json(updatedCategory);
}

export async function DELETE(
  request: Request,
  { params }: { params: { tripId: string; categoryId: string } }
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

  const isMember = trip.members.some((member) => member.userId === user.id);

  if (!isMember && trip.ownerId !== user.id) {
    return forbidden("只有旅程成員可以查看類別");
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以刪除類別");
  }

  const category = await getCategoryForTrip(params.tripId, params.categoryId);

  if (!category) {
    return NextResponse.json({ error: "類別不存在" }, { status: 404 });
  }

  const expenseCount = await prisma.expense.count({
    where: {
      tripId: params.tripId,
      category: category.value,
    },
  });

  if (expenseCount > 0) {
    return NextResponse.json({ error: "此類別已有消費使用，無法刪除" }, { status: 400 });
  }

  await prisma.customCategory.delete({ where: { id: params.categoryId } });

  return NextResponse.json({ success: true });
}
