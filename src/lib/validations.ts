import { z } from "zod";

export const createExpenseSchema = z.object({
  amount: z.coerce.number().positive("金額必須大於 0"),
  currency: z.string().min(1, "請選擇幣別"),
  exchangeRate: z.coerce.number().positive("匯率必須大於 0").default(1),
  category: z.string().min(1, "請選擇類別"),
  description: z.string().min(1, "請輸入說明").max(200, "說明不可超過 200 字"),
  note: z.string().max(500).optional().nullable(),
  settlementMode: z.enum(["normal", "exclude", "external", "partial"]).default("normal"),
  settlementNote: z.string().max(500).optional().nullable(),
  date: z.string().min(1, "請選擇日期"),
  paidById: z.string().min(1, "請選擇付款人"),
  splitType: z.enum(["equal", "percentage", "exact", "payer_only"]).default("equal"),
  receiptUrl: z.string().optional().nullable(),
  splits: z.array(
    z.object({
      memberId: z.string().min(1),
      amount: z.number(),
    })
  ),
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  splits: z
    .array(
      z.object({
        memberId: z.string().min(1),
        amount: z.number(),
      })
    )
    .optional(),
});

export const createTripSchema = z.object({
  name: z.string().min(1, "請輸入旅程名稱").max(100, "旅程名稱不可超過 100 字"),
  description: z.string().max(500).optional().nullable(),
  destination: z.string().max(100).optional().nullable(),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().optional().nullable(),
  currency: z.string().min(1).default("TWD"),
  coverEmoji: z.string().default("✈️"),
});

export const createMemberSchema = z.object({
  name: z.string().min(1, "請輸入成員名稱").max(50, "成員名稱不可超過 50 字"),
});

export const createPaymentSchema = z.object({
  fromMemberId: z.string().min(1, "請選擇付款人"),
  toMemberId: z.string().min(1, "請選擇收款人"),
  amount: z.coerce.number().positive("金額必須大於 0"),
  note: z.string().max(500).optional().nullable(),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(1, "Google 登入憑證遺失，請重新嘗試"),
});

export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((e) => e.message).join("、");
}
