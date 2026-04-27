import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSession, setSessionCookie } from "@/lib/auth";
import { type VerifiedGoogleProfile, verifyGoogleCredential } from "@/lib/google-auth";
import { formatZodErrors, googleLoginSchema } from "@/lib/validations";

async function signInWithGoogleCredential(credential: string) {
  if (
    !process.env.GOOGLE_CLIENT_ID &&
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  ) {
    return {
      ok: false as const,
      status: 500,
      error: "Google 登入尚未設定完成，請稍後再試",
    };
  }

  let profile: VerifiedGoogleProfile;

  try {
    profile = await verifyGoogleCredential(credential);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "GOOGLE_CLIENT_ID_MISSING"
        ? "Google 登入尚未設定完成，請稍後再試"
        : "Google 驗證失敗，請重新登入";

    return {
      ok: false as const,
      status: 401,
      error: message,
    };
  }

  if (!profile.emailVerified) {
    return {
      ok: false as const,
      status: 400,
      error: "Google 帳號 Email 尚未驗證，無法登入",
    };
  }

  let user = await prisma.user.findUnique({ where: { googleSub: profile.sub } });

  if (!user) {
    const existingUser = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingUser) {
      if (existingUser.googleSub && existingUser.googleSub !== profile.sub) {
        return {
          ok: false as const,
          status: 409,
          error: "這個 Email 已綁定其他 Google 帳號",
        };
      }

      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleSub: profile.sub,
          avatarUrl: profile.picture ?? existingUser.avatarUrl,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          googleSub: profile.sub,
          name: profile.name ?? profile.email.split("@")[0],
          avatarUrl: profile.picture,
        },
      });
    }
  } else if (profile.picture && profile.picture !== user.avatarUrl) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: profile.picture },
    });
  }

  const session = await createUserSession(user.id);

  return {
    ok: true as const,
    user,
    session,
  };
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let credential: string | null = null;
  let redirectTo = "/";

  if (contentType.includes("application/json")) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "登入請求格式錯誤" }, { status: 400 });
    }

    const parsed = googleLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    credential = parsed.data.credential;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const parsed = googleLoginSchema.safeParse({
      credential: formData.get("credential"),
    });

    if (!parsed.success) {
      return NextResponse.redirect(new URL("/login?error=invalid_request", request.url));
    }

    credential = parsed.data.credential;
    const nextPath = formData.get("state")?.toString().trim();
    if (nextPath?.startsWith("/")) {
      redirectTo = nextPath;
    }
  } else {
    return NextResponse.json({ error: "不支援的登入請求格式" }, { status: 415 });
  }

  const result = await signInWithGoogleCredential(credential);

  if (!result.ok) {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", encodeURIComponent(result.error));
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  }

  const response = NextResponse.json({ user: result.user });
  setSessionCookie(response, result.session.token, result.session.expiresAt);

  return response;
}
