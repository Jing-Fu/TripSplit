import { NextRequest, NextResponse } from "next/server";
import { createSessionForLineUser, setSessionCookie } from "@/lib/auth";
import { sanitizeReturnToPath } from "@/lib/utils";
import {
  consumePendingLineOAuthState,
  LINE_OAUTH_STATE_COOKIE,
  serializePendingLineOAuthStates,
} from "@/lib/line/oauth-state";

export const runtime = "nodejs";

function applyPendingStateCookie(response: NextResponse, states: { state: string; returnTo: string; expiresAt: number }[]) {
  if (states.length === 0) {
    response.cookies.set(LINE_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return;
  }

  response.cookies.set(LINE_OAUTH_STATE_COOKIE, serializePendingLineOAuthStates(states), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
}

function redirectToLoginWithError(
  request: NextRequest,
  error: string,
  states?: { state: string; returnTo: string; expiresAt: number }[]
) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  const response = NextResponse.redirect(loginUrl);
  if (states) {
    applyPendingStateCookie(response, states);
  }
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!state) {
      return redirectToLoginWithError(request, "state_mismatch");
    }

    const { matchedState, remainingStates } = consumePendingLineOAuthState(
      request.cookies.get(LINE_OAUTH_STATE_COOKIE)?.value,
      state
    );
    const returnTo = sanitizeReturnToPath(matchedState?.returnTo);

    if (!matchedState) {
      return redirectToLoginWithError(request, "state_mismatch");
    }

    if (!code) {
      return redirectToLoginWithError(request, "missing_code", remainingStates);
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

    if (!channelId || !channelSecret || !redirectUri) {
      return redirectToLoginWithError(
        request,
        "LINE Login not configured",
        remainingStates
      );
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
      const tokenErrorText = await tokenRes.text();
      console.error("LINE token exchange failed", {
        status: tokenRes.status,
        body: tokenErrorText,
      });
      return redirectToLoginWithError(
        request,
        `token_exchange_failed: ${tokenRes.status} ${tokenErrorText}`,
        remainingStates
      );
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      const profileErrorText = await profileRes.text();
      console.error("LINE profile fetch failed", {
        status: profileRes.status,
        body: profileErrorText,
      });
      return redirectToLoginWithError(
        request,
        `profile_fetch_failed: ${profileRes.status} ${profileErrorText}`,
        remainingStates
      );
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

    const response = NextResponse.redirect(new URL(returnTo, request.url));
    setSessionCookie(response, session.token, session.expiresAt);
    applyPendingStateCookie(response, remainingStates);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("LINE OAuth callback unexpected error", { message, error });
    return redirectToLoginWithError(request, `oauth_callback_failed: ${message}`);
  }
}
