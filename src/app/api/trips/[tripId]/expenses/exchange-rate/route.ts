import { NextResponse } from "next/server";
import { forbidden, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json();
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const exchangeRate = Number(body.exchangeRate);

  if (!currency || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return NextResponse.json({ error: "請提供有效的幣別與匯率" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { members: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  const membership = trip.members.find((member) => member.userId === user.id);
  if (!membership) {
    return forbidden();
  }

  const result = await prisma.expense.updateMany({
    where: {
      tripId: trip.id,
      currency,
    },
    data: {
      exchangeRate,
    },
  });

  return NextResponse.json({ updatedCount: result.count, currency, exchangeRate });
}
