import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/prisma-json";
import { forbidden, requireUser } from "@/lib/auth";
import { getSignedReadUrl, isReceiptStorageKey } from "@/lib/storage";
import { formatZodErrors, updateTripSchema } from "@/lib/validations";

async function getTripForUser(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      owner: true,
      members: {
        include: { user: true },
      },
      expenses: {
        include: {
          paidBy: { include: { user: true } },
          createdBy: true,
          splits: { include: { member: { include: { user: true } } } },
        },
        orderBy: { date: "desc" },
      },
      payments: {
        include: {
          fromMember: true,
          toMember: true,
          settledBy: true,
        },
        orderBy: { settledAt: "desc" },
      },
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

  const currentMember = trip.members.find((member) => member.userId === user.id) ?? null;
  const expenses = await Promise.all(
    trip.expenses.map(async (expense) => ({
      ...expense,
      receiptUrl: expense.receiptKey && isReceiptStorageKey(expense.receiptKey)
        ? await getSignedReadUrl(expense.receiptKey).catch(() => null)
        : null,
    }))
  );

  return NextResponse.json(serializePrisma({
    ...trip,
    expenses,
    permissions: {
      isOwner: trip.ownerId === user.id,
      canManageMembers: trip.ownerId === user.id,
      canDeleteTrip: trip.ownerId === user.id,
      canAddExpense: Boolean(currentMember) || trip.ownerId === user.id,
    },
    currentUser: user,
    currentMemberId: currentMember?.id ?? null,
  }));
}

export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await prisma.trip.findUnique({ where: { id: params.tripId } });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以修改旅程");
  }

  const body = await request.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const {
    name,
    description,
    destination,
    startDate,
    endDate,
    currency,
    coverEmoji,
  } = parsed.data;

  const updatedTrip = await prisma.trip.update({
    where: { id: params.tripId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(destination !== undefined && { destination }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(currency && { currency }),
      ...(coverEmoji && { coverEmoji }),
    },
    include: { members: true },
  });

  return NextResponse.json(serializePrisma(updatedTrip));
}

export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await prisma.trip.findUnique({ where: { id: params.tripId } });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以刪除旅程");
  }

  await prisma.trip.delete({ where: { id: params.tripId } });
  return NextResponse.json({ success: true });
}
