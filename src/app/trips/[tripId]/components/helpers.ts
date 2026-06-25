import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { splitAmountEvenly } from "@/lib/expense-splits";
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
  customSplits: Record<string, string>,
  splitMemberIds: Record<string, boolean> = {}
) {
  const amount = parseFloat(form.amount || "0");

  if (form.splitType === "equal") {
    const selectedMembers = members.filter((member) => splitMemberIds[member.id] ?? true);
    const amounts = splitAmountEvenly(amount, selectedMembers.length);
    return selectedMembers.map((member, index) => ({
      memberId: member.id,
      amount: amounts[index] ?? 0,
    }));
  }

  if (form.splitType === "payer_only") {
    return [{ memberId: form.paidById, amount }];
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
