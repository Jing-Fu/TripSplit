import { NextRequest, NextResponse } from "next/server";
import { createSessionForLineUser, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("line_oauth_state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

  if (!channelId || !channelSecret || !redirectUri) {
    return NextResponse.json({ error: "LINE Login not configured" }, { status: 500 });
  }

  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 401 });
  }

  const tokenData = await tokenRes.json() as { access_token: string };

  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.json({ error: "profile_fetch_failed" }, { status: 401 });
  }

  const profile = await profileRes.json() as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };

  const session = await createSessionForLineUser({
    lineUserId: profile.userId,
    name: profile.displayName,
    picture: profile.pictureUrl,
  });

  const response = NextResponse.redirect(new URL("/", request.url));
  setSessionCookie(response, session.token, session.expiresAt);

  response.cookies.set("line_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
