import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sanitizeReturnToPath } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

  if (!channelId || !redirectUri) {
    return NextResponse.json({ error: "LINE Login not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnToPath(searchParams.get("returnTo"));
  const state = nanoid(32);
  const nonce = nanoid(16);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid",
    nonce,
  });

  const response = NextResponse.redirect(
    `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  );

  response.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("line_oauth_return_to", returnTo, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
