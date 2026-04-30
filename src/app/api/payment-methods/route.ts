import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  note: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const methods = await prisma.paymentMethod.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(methods);
}

export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const method = await prisma.paymentMethod.create({
    data: {
      userId: user.id,
      label: parsed.data.label,
      note: parsed.data.note,
    },
  });

  return NextResponse.json(method, { status: 201 });
}
