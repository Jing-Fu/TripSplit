import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/utils";

export async function GET() {
  const trips = await prisma.trip.findMany({
    include: {
      members: true,
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(trips);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, destination, startDate, endDate, currency, coverEmoji, members } = body;

  if (!name || !startDate) {
    return NextResponse.json({ error: "名稱和開始日期為必填" }, { status: 400 });
  }

  const trip = await prisma.trip.create({
    data: {
      name,
      description,
      destination,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      currency: currency || "TWD",
      coverEmoji: coverEmoji || "✈️",
      inviteCode: generateInviteCode(),
      members: {
        create: (members || []).map((m: string) => ({ name: m })),
      },
    },
    include: { members: true },
  });

  return NextResponse.json(trip, { status: 201 });
}
