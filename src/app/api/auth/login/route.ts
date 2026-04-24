import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();

  if (!email) {
    return NextResponse.json({ error: "Email 為必填" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    if (!name) {
      return NextResponse.json(
        { error: "首次登入請輸入顯示名稱" },
        { status: 400 }
      );
    }

    user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });
  } else if (name && name !== user.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  const { token, expiresAt } = await createUserSession(user.id);
  const response = NextResponse.json({ user });
  setSessionCookie(response, token, expiresAt);

  return response;
}
