import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";
import { formatZodErrors, updateCategorySchema } from "@/lib/validations";

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
  { params: paramsPromise }: { params: Promise<{ tripId: string; categoryId: string }> }
) {
  const params = await paramsPromise;
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

  if (body.label === undefined && body.emoji === undefined) {
    return NextResponse.json({
      id: category.id,
      value: category.value,
      label: category.label,
      emoji: category.emoji,
    });
  }

  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const label = parsed.data.label?.trim();
  const emoji = parsed.data.emoji?.trim();

  if (parsed.data.label !== undefined && !label) {
    return NextResponse.json({ error: "label 不能為空" }, { status: 400 });
  }

  if (parsed.data.emoji !== undefined && !emoji) {
    return NextResponse.json({ error: "emoji 不能為空" }, { status: 400 });
  }

  const updatedCategory = await prisma.customCategory.update({
    where: { id: params.categoryId },
    data: {
        ...(parsed.data.label !== undefined && { label }),
        ...(parsed.data.emoji !== undefined && { emoji }),
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
  { params: paramsPromise }: { params: Promise<{ tripId: string; categoryId: string }> }
) {
  const params = await paramsPromise;
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
