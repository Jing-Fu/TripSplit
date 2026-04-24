import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, clearSessionCookie } from "@/lib/auth";

function getSessionToken(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? null
  );
}

export async function POST(request: Request) {
  const token = getSessionToken(request.headers.get("cookie"));

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
