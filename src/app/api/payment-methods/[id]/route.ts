import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const method = await prisma.paymentMethod.findUnique({
    where: { id: params.id },
  });

  if (!method) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (method.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.paymentMethod.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
