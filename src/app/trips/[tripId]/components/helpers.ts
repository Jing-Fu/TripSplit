import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatDateForInput } from "@/lib/utils";
import type { ExpenseFormState, Member } from "./types";

export function getCategoryInfo(
  value: string,
  customCats?: { value: string; label: string; emoji: string }[]
) {
  const found = EXPENSE_CATEGORIES.find((category) => category.value === value);
  if (found) return found;
  const custom = customCats?.find((c) => c.value === value);
  if (custom) return custom;
  return { value: "other", label: "其他", emoji: "📝" };
}

export function buildSplits(
  form: ExpenseFormState,
  members: Member[],
  customSplits: Record<string, string>
) {
  const amount = parseFloat(form.amount || "0");

  if (form.splitType === "equal") {
    const perPerson = members.length > 0 ? amount / members.length : 0;
    return members.map((member) => ({
      memberId: member.id,
      amount: Math.round(perPerson * 100) / 100,
    }));
  }

  if (form.splitType === "payer_only") {
    return [{ memberId: form.paidById, amount }];
  }

  if (form.splitType === "percentage") {
    return members
      .filter((member) => customSplits[member.id] && parseFloat(customSplits[member.id]) > 0)
      .map((member) => ({
        memberId: member.id,
        amount: Math.round(amount * (parseFloat(customSplits[member.id]) / 100) * 100) / 100,
      }));
  }

  return members
    .filter((member) => customSplits[member.id] && parseFloat(customSplits[member.id]) > 0)
    .map((member) => ({
      memberId: member.id,
      amount: parseFloat(customSplits[member.id]),
    }));
}

export function getActivityLabel(action: string): string {
  const map: Record<string, string> = {
    expense_created: "新增消費",
    expense_updated: "修改消費",
    expense_deleted: "刪除消費",
    payment_marked: "標記付款",
    payment_updated: "更新付款狀態",
    member_added: "新增成員",
    member_removed: "移除成員",
    backup_imported: "匯入備份",
    backup_exported: "匯出備份",
    notion_exported: "匯出到 Notion",
    notification_generated: "通知產生",
  };
  return map[action] || action;
}

export function getActivityEmoji(action: string): string {
  const map: Record<string, string> = {
    expense_created: "➕",
    expense_updated: "✏️",
    expense_deleted: "🗑️",
    payment_marked: "💸",
    payment_updated: "🔄",
    member_added: "👤",
    member_removed: "👋",
    backup_imported: "♻️",
    backup_exported: "💾",
    notion_exported: "📝",
    notification_generated: "🔔",
  };
  return map[action] || "📋";
}

export function createDefaultExpenseForm(currency = "TWD", paidById = ""): ExpenseFormState {
  return {
    amount: "",
    currency,
    category: "food",
    description: "",
    note: "",
    settlementMode: "normal",
    settlementNote: "",
    date: formatDateForInput(new Date()),
    paidById,
    splitType: "equal",
    receiptKey: "",
    receiptUrl: "",
    exchangeRate: "1",
  };
}
