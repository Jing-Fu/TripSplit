import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await prisma.trip.findFirst({
    where: {
      id: params.tripId,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  const activities = await prisma.activityLog.findMany({
    where: { tripId: params.tripId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(activities);
}
