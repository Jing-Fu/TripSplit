import type { RecordedSettlementPayment, SettlementExpense } from "@/lib/settlement";

export type User = {
  id: string;
  name: string;
  email: string;
};

export type Member = {
  id: string;
  name: string;
  userId: string | null;
  user?: User | null;
};

export type Split = {
  id: string;
  amount: number;
  member: Member;
};

export type Expense = SettlementExpense & {
  note: string | null;
  settlementMode: string;
  settlementNote: string | null;
  receiptUrl: string | null;
  splitType: string;
  createdBy: User | null;
};

export type Payment = RecordedSettlementPayment & {
  settledBy: User;
};

export type TripPermissions = {
  isOwner: boolean;
  canManageMembers: boolean;
  canDeleteTrip: boolean;
  canAddExpense: boolean;
};

export type Trip = {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string | null;
  currency: string;
  coverEmoji: string;
  inviteCode: string;
  owner: User | null;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  permissions: TripPermissions;
  currentUser: User;
  currentMemberId: string | null;
};

export type ActivityLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
};

export type Tab = "expenses" | "add" | "settle" | "summary" | "stats" | "activity";

export type ExpenseFilters = {
  keyword: string;
  category: string;
  paidById: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: ExpenseFilters = {
  keyword: "",
  category: "",
  paidById: "",
  dateFrom: "",
  dateTo: "",
};

export type ExpenseFormState = {
  amount: string;
  currency: string;
  category: string;
  description: string;
  note: string;
  settlementMode: string;
  settlementNote: string;
  date: string;
  paidById: string;
  splitType: string;
  receiptUrl: string;
  exchangeRate: string;
};

export type CustomCategory = {
  id: string;
  value: string;
  label: string;
  emoji: string;
};

export type CategoryOption = {
  value: string;
  label: string;
  emoji: string;
  isCustom: boolean;
};
