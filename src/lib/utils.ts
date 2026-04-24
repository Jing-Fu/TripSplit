import { nanoid } from "nanoid";

export function generateInviteCode(): string {
  return nanoid(8);
}

export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2,
  });
  return formatter.format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function getCategoryInfo(value: string) {
  const { EXPENSE_CATEGORIES } = require("./constants");
  return (
    EXPENSE_CATEGORIES.find(
      (c: { value: string }) => c.value === value
      ) ?? { value: "other", label: "其他", emoji: "📝" }
  );
}

export function getAvailableName(
  preferredName: string,
  existingNames: string[]
) {
  const baseName = preferredName.trim() || "旅伴";

  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.includes(`${baseName} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}
