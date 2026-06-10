import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sanitizeReturnToPath } from "@/lib/utils";
import {
  createPendingLineOAuthStates,
  LINE_OAUTH_STATE_COOKIE,
  serializePendingLineOAuthStates,
} from "@/lib/line/oauth-state";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

  if (!channelId || !redirectUri) {
    return NextResponse.json({ error: "LINE Login not configured" }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(redirectUri);

  if (requestUrl.origin !== redirectUrl.origin) {
    const alignedStartUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, redirectUrl.origin);
    return NextResponse.redirect(alignedStartUrl);
  }

  const { searchParams } = requestUrl;
  const returnTo = sanitizeReturnToPath(searchParams.get("returnTo"));
  const state = nanoid(32);
  const nonce = nanoid(16);
  const pendingStates = createPendingLineOAuthStates(
    request.cookies.get(LINE_OAUTH_STATE_COOKIE)?.value,
    state,
    returnTo
  );

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

  response.cookies.set(LINE_OAUTH_STATE_COOKIE, serializePendingLineOAuthStates(pendingStates), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
