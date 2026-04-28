import { formatDateForInput } from "@/lib/utils";

type ExportableSplit = { member: { name: string }; amount: number };

type ExportableExpense = {
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  category: string;
  date: string;
  paidBy: { name: string };
  splitType: string;
  note: string | null;
  settlementMode: string;
  settlementNote: string | null;
  splits: ExportableSplit[];
};

type ExportablePayment = {
  fromMember: { name: string };
  toMember: { name: string };
  amount: number;
  currency: string;
  status: string;
  settledAt: string;
  note: string | null;
};

type ExportableTrip = {
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string | null;
  currency: string;
  coverEmoji: string;
  members: { name: string }[];
  expenses: ExportableExpense[];
  payments: ExportablePayment[];
};

export function buildClientExportJSON(trip: ExportableTrip) {
  return {
    exportedAt: new Date().toISOString(),
    trip: {
      name: trip.name,
      description: trip.description,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currency: trip.currency,
      coverEmoji: trip.coverEmoji,
    },
    members: trip.members.map((m) => ({ name: m.name })),
    expenses: trip.expenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      exchangeRate: e.exchangeRate,
      category: e.category,
      date: e.date,
      paidBy: e.paidBy.name,
      splitType: e.splitType,
      note: e.note,
      settlementMode: e.settlementMode,
      settlementNote: e.settlementNote,
      splits: e.splits.map((s) => ({
        member: s.member.name,
        amount: s.amount,
      })),
    })),
    payments: trip.payments.map((p) => ({
      from: p.fromMember.name,
      to: p.toMember.name,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      settledAt: p.settledAt,
      note: p.note,
    })),
  };
}

type CategoryLike = { value: string; label: string; emoji: string };

function resolveCategoryLabel(
  value: string,
  customCats?: CategoryLike[]
): string {
  const builtIn: Record<string, string> = {
    food: "餐飲",
    transport: "交通",
    accommodation: "住宿",
    shopping: "購物",
    attraction: "景點門票",
    entertainment: "娛樂",
    groceries: "超市",
    tips: "小費",
    other: "其他",
  };

  if (builtIn[value]) return builtIn[value];
  const custom = customCats?.find((c) => c.value === value);
  return custom?.label ?? "其他";
}

export function buildClientExportCSV(
  trip: ExportableTrip,
  customCats?: CategoryLike[]
) {
  const header = [
    "日期",
    "說明",
    "金額",
    "幣別",
    "匯率",
    "等值金額",
    "類別",
    "付款人",
    "分帳方式",
    "備註",
  ].join(",");

  const rows = trip.expenses.map((e) => {
    const catLabel = resolveCategoryLabel(e.category, customCats);
    return [
      formatDateForInput(e.date),
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.currency,
      e.exchangeRate,
      (e.amount * e.exchangeRate).toFixed(2),
      catLabel,
      e.paidBy.name,
      e.splitType,
      `"${(e.note || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  return "\uFEFF" + [header, ...rows].join("\n");
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
