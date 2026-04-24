import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json().catch(() => ({}));
  const read = body.read !== false;

  const notification = await prisma.notification.findFirst({
    where: {
      id: params.notificationId,
      userId: user.id,
    },
  });

  if (!notification) {
    return NextResponse.json({ error: "通知不存在" }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id: params.notificationId },
    data: {
      readAt: read ? new Date() : null,
    },
  });

  return NextResponse.json(updated);
}
