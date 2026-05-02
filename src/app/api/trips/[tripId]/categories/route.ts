import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";
import { createCategorySchema, formatZodErrors } from "@/lib/validations";

async function getTripForUser(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await getTripForUser(params.tripId, user.id);

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  const categories = await prisma.customCategory.findMany({
    where: { tripId: params.tripId },
    select: {
      id: true,
      value: true,
      label: true,
      emoji: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
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
    return forbidden("只有旅程建立者可以新增類別");
  }

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const value = parsed.data.value.trim();
  const label = parsed.data.label.trim();
  const emoji = parsed.data.emoji?.trim();

  if (!value || !label) {
    return NextResponse.json({ error: "value 與 label 為必填" }, { status: 400 });
  }

  const existingCategory = await prisma.customCategory.findUnique({
    where: {
      tripId_value: {
        tripId: params.tripId,
        value,
      },
    },
  });

  if (existingCategory) {
    return NextResponse.json({ error: "此類別代碼已存在" }, { status: 400 });
  }

  const category = await prisma.customCategory.create({
    data: {
      tripId: params.tripId,
      value,
      label,
      ...(emoji ? { emoji } : {}),
    },
    select: {
      id: true,
      value: true,
      label: true,
      emoji: true,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
