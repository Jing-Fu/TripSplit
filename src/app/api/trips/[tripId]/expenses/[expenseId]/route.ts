import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/prisma-json";
import { forbidden, requireUser } from "@/lib/auth";
import { recordSideEffects } from "@/lib/side-effects";
import { deleteObject, isReceiptStorageKey, isReceiptStorageKeyForUser } from "@/lib/storage";
import { formatZodErrors, updateExpenseSchema } from "@/lib/validations";

async function canManageExpense(userId: string, expenseId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      trip: true,
      paidBy: true,
    },
  });

  if (!expense) {
    return { expense: null, allowed: false };
  }

  const allowed =
    expense.trip.ownerId === userId ||
    expense.createdById === userId ||
    expense.paidBy.userId === userId;

  return { expense, allowed };
}

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string; expenseId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const permission = await canManageExpense(user.id, params.expenseId);

  if (!permission.expense) {
    return NextResponse.json({ error: "費用不存在" }, { status: 404 });
  }

  if (permission.expense.tripId !== params.tripId) {
    return NextResponse.json({ error: "費用不存在" }, { status: 404 });
  }

  if (!permission.allowed) {
    return forbidden("你沒有權限修改這筆費用");
  }

  const body = await request.json();
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

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
    receiptKey,
    settlementMode,
    settlementNote,
  } = parsed.data;

  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { members: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  }

  const nextPaidById = paidById || permission.expense.paidById;
  const paidByMember = trip.members.find((member) => member.id === nextPaidById);

  if (!paidByMember) {
    return NextResponse.json({ error: "付款人不屬於此旅程" }, { status: 400 });
  }

  if (trip.ownerId !== user.id && paidByMember.userId !== user.id) {
    return forbidden("你只能把費用掛在自己的身份下，除非你是旅程建立者");
  }

  const splitPayload = Array.isArray(splits) ? splits : [];
  const validSplitMemberIds = new Set(trip.members.map((member) => member.id));

  if (
    splitPayload.some(
      (split: { memberId: string; amount: number }) =>
        !validSplitMemberIds.has(split.memberId)
    )
  ) {
    return NextResponse.json({ error: "分攤對象必須是旅程成員" }, { status: 400 });
  }

  if (receiptKey && !isReceiptStorageKeyForUser(receiptKey, user.id)) {
    return NextResponse.json({ error: "收據檔案不屬於目前使用者" }, { status: 400 });
  }

  const expense = await prisma.$transaction(async (tx) => {
    await tx.split.deleteMany({ where: { expenseId: params.expenseId } });

    return tx.expense.update({
      where: { id: params.expenseId },
      data: {
        ...(amount !== undefined && { amount }),
        ...(currency && { currency }),
        ...(exchangeRate !== undefined && { exchangeRate }),
        ...(category && { category }),
        ...(description && { description }),
        ...(note !== undefined && { note }),
        ...(date && { date: new Date(date) }),
        ...(paidById && { paidById }),
        ...(splitType && { splitType }),
        ...(receiptKey !== undefined && { receiptKey: receiptKey || null }),
        ...(settlementMode && { settlementMode }),
        ...(settlementNote !== undefined && { settlementNote: settlementNote || null }),
        ...(splits && {
          splits: {
            create: splitPayload.map(
              (split: { memberId: string; amount: number }) => ({
                memberId: split.memberId,
                amount: split.amount,
              })
            ),
          },
        }),
      },
      include: {
        paidBy: { include: { user: true } },
        createdBy: true,
        splits: { include: { member: { include: { user: true } } } },
      },
    });
  });

  await recordSideEffects({
    tripId: params.tripId,
    userId: user.id,
    activity: {
      action: "expense_updated",
      targetType: "expense",
      targetId: expense.id,
      details: `${expense.description} ${expense.amount} ${expense.currency}`,
    },
    notification: {
      actorUserId: user.id,
      type: "expense_updated",
      title: "消費已更新",
      message: `${user.name} 更新了「${expense.description}」`,
    },
  });

  if (
    receiptKey !== undefined &&
    permission.expense.receiptKey &&
    isReceiptStorageKey(permission.expense.receiptKey) &&
    permission.expense.receiptKey !== receiptKey
  ) {
    await deleteObject(permission.expense.receiptKey).catch(() => undefined);
  }

  return NextResponse.json(serializePrisma(expense));
}

export async function DELETE(
  request: Request,
  { params }: { params: { tripId: string; expenseId: string } }
) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const permission = await canManageExpense(user.id, params.expenseId);

  if (!permission.expense) {
    return NextResponse.json({ error: "費用不存在" }, { status: 404 });
  }

  if (permission.expense.tripId !== params.tripId) {
    return NextResponse.json({ error: "費用不存在" }, { status: 404 });
  }

  if (!permission.allowed) {
    return forbidden("你沒有權限刪除這筆費用");
  }

  const expenseToDelete = permission.expense;
  await prisma.expense.delete({ where: { id: params.expenseId } });

  if (expenseToDelete.receiptKey && isReceiptStorageKey(expenseToDelete.receiptKey)) {
    await deleteObject(expenseToDelete.receiptKey).catch(() => undefined);
  }

  await recordSideEffects({
    tripId: params.tripId,
    userId: user.id,
    activity: {
      action: "expense_deleted",
      targetType: "expense",
      targetId: params.expenseId,
      details: `${expenseToDelete.description}`,
    },
    notification: {
      actorUserId: user.id,
      type: "expense_deleted",
      title: "消費已刪除",
      message: `${user.name} 刪除了「${expenseToDelete.description}」`,
    },
  });

  return NextResponse.json({ success: true });
}
