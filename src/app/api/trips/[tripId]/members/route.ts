import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const body = await request.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "名稱為必填" }, { status: 400 });
  }

  const existing = await prisma.member.findUnique({
    where: { tripId_name: { tripId: params.tripId, name } },
  });

  if (existing) {
    return NextResponse.json({ error: "此成員已存在" }, { status: 409 });
  }

  const member = await prisma.member.create({
    data: { name, tripId: params.tripId },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "memberId 為必填" }, { status: 400 });
  }

  await prisma.member.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
