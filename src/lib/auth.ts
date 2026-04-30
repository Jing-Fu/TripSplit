import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "tripsplit_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? null
  );
}

export async function getCurrentUser(request: Request) {
  const sessionToken = getCookieValue(
    request.headers.get("cookie"),
    AUTH_COOKIE_NAME
  );

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}

export async function createUserSession(userId: string) {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function createSessionForLineUser(profile: {
  lineUserId: string;
  name: string;
  picture?: string;
}) {
  const user = await prisma.user.upsert({
    where: { lineUserId: profile.lineUserId },
    update: {
      lineDisplayName: profile.name,
      linePictureUrl: profile.picture ?? null,
    },
    create: {
      lineUserId: profile.lineUserId,
      name: profile.name,
      lineDisplayName: profile.name,
      linePictureUrl: profile.picture ?? null,
      linePushEnabled: true,
    },
  });

  return createUserSession(user.id);
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "none",
    secure: true,
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    expires: new Date(0),
    path: "/",
  });
}

export function unauthorized(message = "請先登入") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "你沒有權限執行這個操作") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, error: unauthorized() };
  }

  return { user, error: null };
}
