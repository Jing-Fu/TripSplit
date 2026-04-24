import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { buildTripExportJSON, getTripForUser } from "@/lib/trip-export";

export async function GET(
  request: Request,
  { params }: { params: { tripId: string } }
) {
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
  { params }: { params: { tripId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const trip = await getTripForUser(params.tripId, user.id);

  if (!trip) {
    return NextResponse.json({ error: "找不到此旅程" }, { status: 404 });
  }

  const payload = buildTripExportJSON(trip);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${params.tripId}-${timestamp}.json`;
  const publicDir = join(process.cwd(), "public");
  const backupDir = join(publicDir, "backups");
  const fileSystemPath = join(backupDir, fileName);
  const publicFilePath = `/backups/${fileName}`;
  const content = JSON.stringify(payload, null, 2);
  const fileSize = Buffer.byteLength(content, "utf8");

  await mkdir(backupDir, { recursive: true });
  await writeFile(fileSystemPath, content, "utf8");

  const backupRecord = await prisma.backupRecord.create({
    data: {
      tripId: params.tripId,
      fileName,
      filePath: publicFilePath,
      fileSize,
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
    },
  });

  await logActivity({
    tripId: params.tripId,
    userId: user.id,
    action: "backup_exported",
    targetType: "trip",
    targetId: params.tripId,
    details: fileName,
  });

  await createNotificationsForTrip({
    tripId: params.tripId,
    actorUserId: user.id,
    type: "backup_exported",
    title: "旅程已匯出備份",
    message: `${user.name} 匯出了「${trip.name}」的備份`,
  });

  return NextResponse.json(backupRecord, { status: 201 });
}
