import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: {
      trip: {
        select: {
          id: true,
          name: true,
          coverEmoji: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(notifications);
}
