import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string; expenseId: string } }
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

  await prisma.split.deleteMany({ where: { expenseId: params.expenseId } });

  const expense = await prisma.expense.update({
    where: { id: params.expenseId },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(currency && { currency }),
      ...(exchangeRate !== undefined && { exchangeRate: parseFloat(exchangeRate) }),
      ...(category && { category }),
      ...(description && { description }),
      ...(note !== undefined && { note }),
      ...(date && { date: new Date(date) }),
      ...(paidById && { paidById }),
      ...(splitType && { splitType }),
      ...(splits && {
        splits: {
          create: splits.map(
            (s: { memberId: string; amount: number }) => ({
              memberId: s.memberId,
              amount: s.amount,
            })
          ),
        },
      }),
    },
    include: { paidBy: true, splits: { include: { member: true } } },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tripId: string; expenseId: string } }
) {
  await prisma.expense.delete({ where: { id: params.expenseId } });
  return NextResponse.json({ success: true });
}
