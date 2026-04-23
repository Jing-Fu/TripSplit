import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { inviteCode } = await request.json();

  if (!inviteCode) {
    return NextResponse.json({ error: "請提供邀請碼" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { inviteCode },
    select: { id: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "邀請碼無效" }, { status: 404 });
  }

  return NextResponse.json({ tripId: trip.id });
}
