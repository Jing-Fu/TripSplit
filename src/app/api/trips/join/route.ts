import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getAvailableName } from "@/lib/utils";

export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const { inviteCode } = await request.json();

  if (!inviteCode) {
    return NextResponse.json({ error: "請提供邀請碼" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { inviteCode },
    include: {
      members: true,
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "邀請碼無效" }, { status: 404 });
  }

  const existingMember = trip.members.find((member) => member.userId === user.id);

  if (!existingMember) {
    const claimableMember = trip.members.find(
      (member) => !member.userId && member.name === user.name
    );

    if (claimableMember) {
      await prisma.member.update({
        where: { id: claimableMember.id },
        data: { userId: user.id },
      });
    } else {
      const memberName = getAvailableName(
        user.name,
        trip.members.map((member) => member.name)
      );

      await prisma.member.create({
        data: {
          tripId: trip.id,
          userId: user.id,
          name: memberName,
        },
      });
    }
  }

  if (!trip.ownerId) {
    await prisma.trip.update({
      where: { id: trip.id },
      data: { ownerId: user.id },
    });
  }

  return NextResponse.json({ tripId: trip.id });
}
