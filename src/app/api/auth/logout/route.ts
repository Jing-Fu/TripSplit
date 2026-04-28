import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, clearSessionCookie, getCookieValue } from "@/lib/auth";

export async function POST(request: Request) {
  const token = getCookieValue(request.headers.get("cookie"), AUTH_COOKIE_NAME);

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
