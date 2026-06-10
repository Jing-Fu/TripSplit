import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ claimToken: string }> }
) {
  const params = await paramsPromise;
  const viewer = await getCurrentUser(request);
  const member = await prisma.member.findUnique({
    where: { claimToken: params.claimToken },
    include: {
      trip: {
        select: {
          id: true,
          name: true,
          coverEmoji: true,
          ownerId: true,
          members: {
            select: { id: true, userId: true },
          },
        },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "找不到這個專屬加入連結" }, { status: 404 });
  }

  const viewerAlreadyJoined = viewer
    ? member.trip.members.some((tripMember) => tripMember.userId === viewer.id)
    : false;

  return NextResponse.json({
    tripId: member.trip.id,
    tripName: member.trip.name,
    tripCoverEmoji: member.trip.coverEmoji,
    memberName: member.name,
    claimed: Boolean(member.userId),
    claimedByViewer: viewer ? member.userId === viewer.id : false,
    viewerAlreadyJoined,
    viewerAuthenticated: Boolean(viewer),
  });
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ claimToken: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const member = await prisma.member.findUnique({
    where: { claimToken: params.claimToken },
    include: {
      trip: {
        select: {
          id: true,
          ownerId: true,
          members: {
            select: { id: true, userId: true },
          },
        },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "找不到這個專屬加入連結" }, { status: 404 });
  }

  if (member.userId === user.id) {
    return NextResponse.json({ tripId: member.tripId, memberId: member.id });
  }

  if (member.userId) {
    return NextResponse.json({ error: "這個成員名額已經被其他人認領" }, { status: 409 });
  }

  if (member.trip.members.some((tripMember) => tripMember.userId === user.id)) {
    return NextResponse.json({ error: "你已經加入這個旅程，不能再認領另一個身份" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.member.update({
      where: { id: member.id },
      data: {
        userId: user.id,
        claimToken: null,
      },
    }),
    ...(member.trip.ownerId
      ? []
      : [
          prisma.trip.update({
            where: { id: member.tripId },
            data: { ownerId: user.id },
          }),
        ]),
  ]);

  return NextResponse.json({ tripId: member.tripId, memberId: member.id });
}
