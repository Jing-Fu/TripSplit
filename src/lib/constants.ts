export const EXPENSE_CATEGORIES = [
  { value: "food", label: "餐飲", emoji: "🍜" },
  { value: "transport", label: "交通", emoji: "🚗" },
  { value: "accommodation", label: "住宿", emoji: "🏨" },
  { value: "shopping", label: "購物", emoji: "🛍️" },
  { value: "attraction", label: "景點門票", emoji: "🎫" },
  { value: "entertainment", label: "娛樂", emoji: "🎮" },
  { value: "groceries", label: "超市", emoji: "🛒" },
  { value: "tips", label: "小費", emoji: "💰" },
  { value: "other", label: "其他", emoji: "📝" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

export const CURRENCIES = [
  { code: "TWD", name: "新台幣", symbol: "NT$" },
  { code: "USD", name: "美元", symbol: "$" },
  { code: "EUR", name: "歐元", symbol: "€" },
  { code: "JPY", name: "日圓", symbol: "¥" },
  { code: "KRW", name: "韓元", symbol: "₩" },
  { code: "GBP", name: "英鎊", symbol: "£" },
  { code: "CNY", name: "人民幣", symbol: "¥" },
  { code: "THB", name: "泰銖", symbol: "฿" },
  { code: "VND", name: "越南盾", symbol: "₫" },
  { code: "SGD", name: "新加坡幣", symbol: "S$" },
  { code: "MYR", name: "馬來西亞令吉", symbol: "RM" },
  { code: "AUD", name: "澳幣", symbol: "A$" },
  { code: "CAD", name: "加幣", symbol: "C$" },
  { code: "HKD", name: "港幣", symbol: "HK$" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const SPLIT_TYPES = [
  { value: "equal", label: "平均分攤" },
  { value: "percentage", label: "按比例" },
  { value: "exact", label: "自訂金額" },
  { value: "payer_only", label: "付款人自付" },
] as const;

export type SplitType = (typeof SPLIT_TYPES)[number]["value"];

export const TRIP_EMOJIS = [
  "✈️", "🏖️", "🗻", "🏕️", "🚢", "🎿", "🏝️", "🌍",
  "🇯🇵", "🇰🇷", "🇹🇭", "🇻🇳", "🇺🇸", "🇬🇧", "🇫🇷", "🇩🇪",
  "🇮🇹", "🇪🇸", "🇦🇺", "🇨🇦", "🇸🇬", "🇲🇾", "🇮🇩", "🇵🇭",
];
