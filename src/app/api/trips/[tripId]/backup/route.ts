import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordSideEffects } from "@/lib/side-effects";
import { uploadObject } from "@/lib/storage";
import { buildTripExportJSON, getTripForUser } from "@/lib/trip-export";

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await getTripForUser(params.tripId, user.id);

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  const records = await prisma.backupRecord.findMany({
    where: { tripId: params.tripId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ tripId: string }> }
) {
  const params = await paramsPromise;
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await getTripForUser(params.tripId, user.id);

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  const payload = buildTripExportJSON(trip);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${params.tripId}-${timestamp}.json`;
  const content = JSON.stringify(payload, null, 2);
  const fileSize = Buffer.byteLength(content, "utf8");

  const key = `backups/${fileName}`;
  await uploadObject(key, Buffer.from(content, "utf8"), "application/json");

  const backupRecord = await prisma.backupRecord.create({
    data: {
      tripId: params.tripId,
      fileName,
      storageKey: key,
      fileSize,
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
    },
  });

  await recordSideEffects({
    tripId: params.tripId,
    userId: user.id,
    activity: {
      action: "backup_exported",
      targetType: "trip",
      targetId: params.tripId,
      details: fileName,
    },
    notification: {
      actorUserId: user.id,
      type: "backup_exported",
      title: "旅程已匯出備份",
      message: `${user.name} 匯出了「${trip.name}」的備份`,
    },
  });

  return NextResponse.json(backupRecord, { status: 201 });
}
