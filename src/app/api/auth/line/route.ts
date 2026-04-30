import { NextResponse } from "next/server";
import { verifyLiffIdToken } from "@/lib/line/verify";
import { LineAuthError } from "@/lib/line/errors";
import { createSessionForLineUser, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = body as Record<string, unknown>;
  if (!body || typeof body !== "object" || typeof parsed["idToken"] !== "string") {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  const idToken = parsed["idToken"] as string;

  let profile: { lineUserId: string; name: string; picture?: string };
  try {
    profile = await verifyLiffIdToken(idToken);
  } catch (err) {
    if (err instanceof LineAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    return NextResponse.json({ error: "verify_failed" }, { status: 401 });
  }

  const session = await createSessionForLineUser(profile);

  const response = NextResponse.json({
    user: {
      lineUserId: profile.lineUserId,
      name: profile.name,
    },
  });

  setSessionCookie(response, session.token, session.expiresAt);

  return response;
}
