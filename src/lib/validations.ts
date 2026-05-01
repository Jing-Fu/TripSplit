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
  receiptKey: z.string().optional().nullable(),
  splits: z.array(
    z.object({
      memberId: z.string().min(1),
      amount: z.coerce.number().nonnegative("分攤金額不可小於 0"),
    })
  ),
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  splits: z
    .array(
      z.object({
        memberId: z.string().min(1),
        amount: z.coerce.number().nonnegative("分攤金額不可小於 0"),
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

export const updateTripSchema = createTripSchema.partial();

export const updatePaymentStatusSchema = z.object({
  status: z.enum(["completed", "cancelled"]),
});

export const joinTripSchema = z.object({
  inviteCode: z.string().min(1, "請提供邀請碼"),
});

export const createCategorySchema = z.object({
  value: z.string().min(1, "value 為必填"),
  label: z.string().min(1, "label 為必填"),
  emoji: z.string().optional(),
});

export const updateCategorySchema = z
  .object({
    label: z.string().min(1, "label 不能為空").optional(),
    emoji: z.string().min(1, "emoji 不能為空").optional(),
  })
  .refine((data) => data.label !== undefined || data.emoji !== undefined, {
    message: "至少需要提供 label 或 emoji",
  });

export const importTripSchema = z.object({
  trip: z.object({
    name: z.string().min(1, "備份檔缺少旅程名稱"),
    description: z.string().nullable().optional(),
    destination: z.string().nullable().optional(),
    startDate: z.string().min(1, "備份檔缺少開始日期"),
    endDate: z.string().nullable().optional(),
    currency: z.string().optional(),
    coverEmoji: z.string().optional(),
  }),
  members: z
    .array(z.object({ name: z.string().optional() }))
    .optional(),
  expenses: z
    .array(
      z.object({
        description: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().optional(),
        category: z.string().optional(),
        date: z.string().optional(),
        paidBy: z.string().optional(),
        splitType: z.string().optional(),
        note: z.string().nullable().optional(),
        settlementMode: z.string().optional(),
        settlementNote: z.string().nullable().optional(),
        splits: z
          .array(
            z.object({
              member: z.string().optional(),
              amount: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  payments: z
    .array(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        settledAt: z.string().optional(),
        note: z.string().nullable().optional(),
      })
    )
    .optional(),
});


export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((e) => e.message).join("、");
}
