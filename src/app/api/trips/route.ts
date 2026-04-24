import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateInviteCode, getAvailableName } from "@/lib/utils";
import { createTripSchema, formatZodErrors } from "@/lib/validations";

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

  const result = createTripSchema.safeParse({
    name,
    description,
    destination,
    startDate,
    endDate,
    currency,
    coverEmoji,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: formatZodErrors(result.error) },
      { status: 400 }
    );
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
      name: result.data.name,
      description: result.data.description,
      destination: result.data.destination,
      startDate: new Date(result.data.startDate),
      endDate: result.data.endDate ? new Date(result.data.endDate) : null,
      currency: result.data.currency,
      coverEmoji: result.data.coverEmoji,
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
