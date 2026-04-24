import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string; paymentId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const payment = await prisma.settlementPayment.findUnique({
    where: { id: params.paymentId },
    include: { trip: true },
  });

  if (!payment || payment.tripId !== params.tripId) {
    return NextResponse.json({ error: "付款紀錄不存在" }, { status: 404 });
  }

  const hasAccess =
    payment.trip.ownerId === user.id || payment.settledById === user.id;

  if (!hasAccess) {
    return forbidden("你沒有權限更新這筆付款紀錄");
  }

  const body = await request.json();
  const status = body.status === "cancelled" ? "cancelled" : "completed";

  const updatedPayment = await prisma.settlementPayment.update({
    where: { id: params.paymentId },
    data: { status },
    include: {
      fromMember: true,
      toMember: true,
      settledBy: true,
    },
  });

  await logActivity({
    tripId: params.tripId,
    userId: user.id,
    action: "payment_updated",
    targetType: "payment",
    targetId: updatedPayment.id,
    details: `${updatedPayment.fromMember.name} → ${updatedPayment.toMember.name} 狀態: ${status}`,
  });

  await createNotificationsForTrip({
    tripId: params.tripId,
    actorUserId: user.id,
    type: "payment_updated",
    title: "付款狀態已更新",
    message: `${updatedPayment.fromMember.name} → ${updatedPayment.toMember.name} 已${status === "completed" ? "完成" : "取消"}`,
  });

  return NextResponse.json(updatedPayment);
}
