import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateInviteCode, getAvailableName } from "@/lib/utils";

export async function GET(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      members: true,
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(trips);
}

export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json();
  const {
    name,
    description,
    destination,
    startDate,
    endDate,
    currency,
    coverEmoji,
    members,
  } = body;

  if (!name || !startDate) {
    return NextResponse.json({ error: "名稱和開始日期為必填" }, { status: 400 });
  }

  const requestedMembers = Array.isArray(members)
    ? members
        .map((member: string) => member.trim())
        .filter(Boolean)
    : [];

  const creatorMemberName = getAvailableName(user.name, requestedMembers);
  const memberCreates = [
    {
      name: creatorMemberName,
      userId: user.id,
    },
    ...requestedMembers
      .filter((memberName: string) => memberName !== creatorMemberName)
      .map((memberName: string) => ({ name: memberName })),
  ];

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
      ownerId: user.id,
      members: {
        create: memberCreates,
      },
    },
    include: { members: true },
  });

  return NextResponse.json(trip, { status: 201 });
}
