import { NextRequest, NextResponse } from "next/server";
import { createSessionForLineUser, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

function redirectToLoginWithError(request: NextRequest, error: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("line_oauth_state")?.value;

    if (!state || !storedState || state !== storedState) {
      return redirectToLoginWithError(request, "state_mismatch");
    }

    if (!code) {
      return redirectToLoginWithError(request, "missing_code");
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

    if (!channelId || !channelSecret || !redirectUri) {
      return redirectToLoginWithError(request, "LINE Login not configured");
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
        `token_exchange_failed: ${tokenRes.status} ${tokenErrorText}`
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
        `profile_fetch_failed: ${profileRes.status} ${profileErrorText}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("LINE OAuth callback unexpected error", { message, error });
    return redirectToLoginWithError(request, `oauth_callback_failed: ${message}`);
  }
}
