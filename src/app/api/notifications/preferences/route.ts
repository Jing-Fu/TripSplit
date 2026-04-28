import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  NOTIFICATION_PREFERENCE_FIELDS,
  type NotificationPreferenceField,
} from "@/lib/constants";

type PreferenceField = NotificationPreferenceField;

async function getOrCreatePreference(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function GET(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const preference = await getOrCreatePreference(user.id);

  return NextResponse.json(preference);
}

export async function PATCH(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "請提供有效的偏好設定資料" }, { status: 400 });
  }

  const entries = Object.entries(body);
  const updateData: Partial<Record<PreferenceField, boolean>> = {};

  for (const [key, value] of entries) {
    if (!NOTIFICATION_PREFERENCE_FIELDS.includes(key as PreferenceField)) {
      return NextResponse.json({ error: `不支援的偏好設定欄位：${key}` }, { status: 400 });
    }

    if (typeof value !== "boolean") {
      return NextResponse.json({ error: `${key} 必須是布林值` }, { status: 400 });
    }

    updateData[key as PreferenceField] = value;
  }

  const preference = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: updateData,
    create: {
      userId: user.id,
      ...updateData,
    },
  });

  return NextResponse.json(preference);
}
