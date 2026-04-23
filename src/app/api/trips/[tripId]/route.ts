import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { tripId: string } }
) {
  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: {
      members: true,
      expenses: {
        include: { paidBy: true, splits: { include: { member: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  return NextResponse.json(trip);
}

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const body = await request.json();
  const { name, description, destination, startDate, endDate, currency, coverEmoji } = body;

  const trip = await prisma.trip.update({
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

  return NextResponse.json(trip);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tripId: string } }
) {
  await prisma.trip.delete({ where: { id: params.tripId } });
  return NextResponse.json({ success: true });
}
