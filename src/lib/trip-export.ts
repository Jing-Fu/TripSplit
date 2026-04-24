import { prisma } from "@/lib/prisma";

export async function getTripForUser(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
      },
      expenses: {
        include: {
          paidBy: true,
          splits: {
            include: {
              member: true,
            },
          },
        },
        orderBy: { date: "desc" },
      },
      payments: {
        include: {
          fromMember: true,
          toMember: true,
        },
        orderBy: { settledAt: "desc" },
      },
    },
  });
}

export type TripForExport = NonNullable<Awaited<ReturnType<typeof getTripForUser>>>;

export function buildTripExportJSON(trip: TripForExport) {
  return {
    exportedAt: new Date().toISOString(),
    trip: {
      name: trip.name,
      description: trip.description,
      destination: trip.destination,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate ? trip.endDate.toISOString() : null,
      currency: trip.currency,
      coverEmoji: trip.coverEmoji,
    },
    members: trip.members.map((member) => ({ name: member.name })),
    expenses: trip.expenses.map((expense) => ({
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      exchangeRate: expense.exchangeRate,
      category: expense.category,
      date: expense.date.toISOString(),
      paidBy: expense.paidBy.name,
      splitType: expense.splitType,
      note: expense.note,
      settlementMode: expense.settlementMode,
      settlementNote: expense.settlementNote,
      splits: expense.splits.map((split) => ({
        member: split.member.name,
        amount: split.amount,
      })),
    })),
    payments: trip.payments.map((payment) => ({
      from: payment.fromMember.name,
      to: payment.toMember.name,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      settledAt: payment.settledAt.toISOString(),
      note: payment.note,
    })),
  };
}

export type TripExportPayload = ReturnType<typeof buildTripExportJSON>;
