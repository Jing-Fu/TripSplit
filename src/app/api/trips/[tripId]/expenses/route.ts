import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  const body = await request.json();
  const {
    amount,
    currency,
    exchangeRate,
    category,
    description,
    note,
    date,
    paidById,
    splitType,
    splits,
  } = body;

  if (!amount || !category || !description || !date || !paidById) {
    return NextResponse.json({ error: "缺少必填欄位" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      amount: parseFloat(amount),
      currency: currency || "TWD",
      exchangeRate: exchangeRate ? parseFloat(exchangeRate) : 1.0,
      category,
      description,
      note,
      date: new Date(date),
      paidById,
      tripId: params.tripId,
      splitType: splitType || "equal",
      splits: {
        create: (splits || []).map(
          (s: { memberId: string; amount: number }) => ({
            memberId: s.memberId,
            amount: s.amount,
          })
        ),
      },
    },
    include: { paidBy: true, splits: { include: { member: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
