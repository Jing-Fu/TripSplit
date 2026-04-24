import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotificationsForTrip } from "@/lib/notifications";

async function getTripForUser(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
      },
      expenses: {
        include: {
          paidBy: true,
          splits: {
            include: {
              member: true,
            },
          },
        },
        orderBy: { date: "desc" },
      },
      payments: {
        include: {
          fromMember: true,
          toMember: true,
        },
        orderBy: { settledAt: "desc" },
      },
    },
  });
}

function buildTripExportJSON(trip: Awaited<ReturnType<typeof getTripForUser>>) {
  if (!trip) {
    return null;
  }

  return {
    exportedAt: new Date().toISOString(),
    trip: {
      name: trip.name,
      description: trip.description,
      destination: trip.destination,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate ? trip.endDate.toISOString() : null,
      currency: trip.currency,
      coverEmoji: trip.coverEmoji,
    },
    members: trip.members.map((member) => ({ name: member.name })),
    expenses: trip.expenses.map((expense) => ({
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      exchangeRate: expense.exchangeRate,
      category: expense.category,
      date: expense.date.toISOString(),
      paidBy: expense.paidBy.name,
      splitType: expense.splitType,
      note: expense.note,
      settlementMode: expense.settlementMode,
      settlementNote: expense.settlementNote,
      splits: expense.splits.map((split) => ({
        member: split.member.name,
        amount: split.amount,
      })),
    })),
    payments: trip.payments.map((payment) => ({
      from: payment.fromMember.name,
      to: payment.toMember.name,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      settledAt: payment.settledAt.toISOString(),
      note: payment.note,
    })),
  };
}

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

  if (!payload) {
    return NextResponse.json({ error: "無法建立備份" }, { status: 500 });
  }

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
