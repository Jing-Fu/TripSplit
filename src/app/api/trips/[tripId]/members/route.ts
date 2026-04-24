import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";
import { getAvailableName } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
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

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以新增成員");
  }

  const body = await request.json();
  const preferredName = body.name?.trim();

  if (!preferredName) {
    return NextResponse.json({ error: "名稱為必填" }, { status: 400 });
  }

  const name = getAvailableName(
    preferredName,
    trip.members.map((member) => member.name)
  );

  const member = await prisma.member.create({
    data: { name, tripId: params.tripId },
  });

  await logActivity({
    tripId: params.tripId,
    userId: user.id,
    action: "member_added",
    targetType: "member",
    targetId: member.id,
    details: name,
  });

  await createNotificationsForTrip({
    tripId: params.tripId,
    actorUserId: user.id,
    type: "member_added",
    title: "旅伴已新增",
    message: `${user.name} 新增了旅伴「${name}」`,
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "memberId 為必填" }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { trip: true },
  });

  if (!member) {
    return NextResponse.json({ error: "成員不存在" }, { status: 404 });
  }

  if (member.trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以移除成員");
  }

  if (member.userId === user.id) {
    return NextResponse.json(
      { error: "建立者自己的成員身份不能直接移除" },
      { status: 400 }
    );
  }

  await prisma.member.delete({ where: { id: memberId } });

  await logActivity({
    tripId: member.trip.id,
    userId: user.id,
    action: "member_removed",
    targetType: "member",
    targetId: memberId,
    details: member.name,
  });

  await createNotificationsForTrip({
    tripId: member.trip.id,
    actorUserId: user.id,
    type: "member_removed",
    title: "旅伴已移除",
    message: `${user.name} 移除了旅伴「${member.name}」`,
  });

  return NextResponse.json({ success: true });
}
