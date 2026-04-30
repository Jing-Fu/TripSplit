import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line/signature";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface LineWebhookEvent {
  type: string;
  source?: {
    type: string;
    userId?: string;
  };
}

interface LineWebhookBody {
  events: LineWebhookEvent[];
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-line-signature");
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifyLineSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(raw) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await Promise.allSettled(
    body.events.map(async (event) => {
      const lineUserId = event.source?.userId;
      if (!lineUserId) return;

      if (event.type === "follow") {
        await prisma.user.upsert({
          where: { lineUserId },
          update: { linePushEnabled: true },
          create: {
            lineUserId,
            name: lineUserId,
            linePushEnabled: true,
          },
        });
      } else if (event.type === "unfollow") {
        await prisma.user.updateMany({
          where: { lineUserId },
          data: { linePushEnabled: false },
        });
      }
    })
  );

  return NextResponse.json({ ok: true });
}
