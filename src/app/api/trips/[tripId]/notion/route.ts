import { NextResponse } from "next/server";
import { forbidden, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { exportTripToNotion, NotionApiError, NotionConfigError } from "@/lib/notion";
import { createNotificationsForTrip } from "@/lib/notifications";
import { buildTripExportJSON, getTripForUser } from "@/lib/trip-export";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await getTripForUser(params.tripId, user.id);

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  if (trip.ownerId !== user.id) {
    return forbidden("只有旅程建立者可以匯出到 Notion");
  }

  try {
    const payload = buildTripExportJSON(trip);
    const result = await exportTripToNotion(payload);

    await logActivity({
      tripId: params.tripId,
      userId: user.id,
      action: "notion_exported",
      targetType: "trip",
      targetId: params.tripId,
      details: result.pageUrl,
    });

    await createNotificationsForTrip({
      tripId: params.tripId,
      actorUserId: user.id,
      type: "notion_exported",
      title: "旅程已匯出到 Notion",
      message: `${user.name} 已將「${trip.name}」匯出到 Notion`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (caughtError) {
    if (caughtError instanceof NotionConfigError) {
      return NextResponse.json({ error: caughtError.message }, { status: 503 });
    }

    if (caughtError instanceof NotionApiError) {
      return NextResponse.json({ error: caughtError.message }, { status: 502 });
    }

    return NextResponse.json({ error: "匯出到 Notion 失敗" }, { status: 500 });
  }
}
