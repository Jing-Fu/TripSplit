import { NextResponse } from "next/server";
import { forbidden, requireUser } from "@/lib/auth";
import { getTripForReminder, sendSettlementReminders } from "@/lib/settlement-reminders";

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return NextResponse.json({ error: "LINE 推播尚未設定" }, { status: 500 });
  }

  const trip = await getTripForReminder(params.tripId);
  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以完成結算並推播提醒");
  }

  const result = await sendSettlementReminders(trip);
  return NextResponse.json({ ok: true, ...result });
}
