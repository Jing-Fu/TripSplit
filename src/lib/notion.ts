import type { TripExportPayload } from "@/lib/trip-export";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";
const MAX_BLOCKS_PER_REQUEST = 100;
const MAX_TEXT_LENGTH = 1900;
const MAX_TITLE_LENGTH = 200;

type NotionRichText = {
  type: "text";
  text: {
    content: string;
    link?: { url: string } | null;
  };
};

type NotionParagraphBlock = {
  object: "block";
  type: "paragraph";
  paragraph: {
    rich_text: NotionRichText[];
  };
};

type NotionHeadingBlock = {
  object: "block";
  type: "heading_2";
  heading_2: {
    rich_text: NotionRichText[];
  };
};

type NotionBulletedListItemBlock = {
  object: "block";
  type: "bulleted_list_item";
  bulleted_list_item: {
    rich_text: NotionRichText[];
  };
};

type NotionDividerBlock = {
  object: "block";
  type: "divider";
  divider: Record<string, never>;
};

type NotionCalloutBlock = {
  object: "block";
  type: "callout";
  callout: {
    rich_text: NotionRichText[];
    icon: {
      type: "emoji";
      emoji: string;
    };
  };
};

type NotionTableRowBlock = {
  object: "block";
  type: "table_row";
  table_row: {
    cells: NotionRichText[][];
  };
};

type NotionTableBlock = {
  object: "block";
  type: "table";
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
    children: NotionTableRowBlock[];
  };
};

type NotionBlock =
  | NotionParagraphBlock
  | NotionHeadingBlock
  | NotionBulletedListItemBlock
  | NotionDividerBlock
  | NotionCalloutBlock
  | NotionTableBlock
  | NotionTableRowBlock;

type NotionPageResponse = {
  id: string;
  url: string;
};

type NotionBlockListResponse = {
  results: Array<{
    id: string;
    type: string;
  }>;
};

type NotionTableDefinition = {
  title: string;
  header: string[];
  rows: string[][];
};

type NotionPageContent = {
  introBlocks: NotionBlock[];
  tables: NotionTableDefinition[];
};

export class NotionConfigError extends Error {}
export class NotionApiError extends Error {}

function truncateText(value: string, maxLength = MAX_TEXT_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function text(content: string, link?: string): NotionRichText[] {
  return [
    {
      type: "text",
      text: {
        content: truncateText(content),
        ...(link ? { link: { url: link } } : {}),
      },
    },
  ];
}

function cell(content: string): NotionRichText[] {
  return text(content || "-");
}

function paragraph(content: string, link?: string): NotionParagraphBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: text(content, link),
    },
  };
}

function heading(content: string): NotionHeadingBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: text(content),
    },
  };
}

function bullet(content: string): NotionBulletedListItemBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: text(content),
    },
  };
}

function divider(): NotionDividerBlock {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

function callout(content: string, emoji = "🧾"): NotionCalloutBlock {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: text(content),
      icon: {
        type: "emoji",
        emoji,
      },
    },
  };
}

function tableRow(cells: string[]): NotionTableRowBlock {
  return {
    object: "block",
    type: "table_row",
    table_row: {
      cells: cells.map((value) => cell(value)),
    },
  };
}

function tableBlock(header: string[]): NotionTableBlock {
  return {
    object: "block",
    type: "table",
    table: {
      table_width: header.length,
      has_column_header: true,
      has_row_header: false,
      children: [tableRow(header)],
    },
  };
}

function formatDate(value: string | null) {
  if (!value) return "未設定";

  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatSettlementMode(mode: string, note: string | null) {
  if (mode === "normal") {
    return "正常納入結算";
  }

  if (mode === "exclude") {
    return note ? `保留記帳，不納入結算（${note}）` : "保留記帳，不納入結算";
  }

  if (mode === "external") {
    return note ? `已線下處理 / 私人支出（${note}）` : "已線下處理 / 私人支出";
  }

  if (mode === "partial") {
    return `部分納入結算（${note || "50"}%）`;
  }

  return mode;
}

function buildPageTitle(payload: TripExportPayload) {
  const startDate = formatDate(payload.trip.startDate);
  return truncateText(`${payload.trip.name} · ${startDate}`, MAX_TITLE_LENGTH);
}

function buildSummaryBlocks(payload: TripExportPayload): NotionBlock[] {
  const total = payload.expenses.reduce(
    (sum, expense) => sum + expense.amount * expense.exchangeRate,
    0
  );
  const completedPayments = payload.payments.filter(
    (payment) => payment.status === "completed"
  ).length;

  return [
    callout(
      `由 TripSplit 匯出於 ${formatDate(payload.exportedAt)}。這份頁面是旅程資料的 Notion 快照，原始資料仍以 TripSplit 為準。`,
      payload.trip.coverEmoji || "✈️"
    ),
    heading("旅程摘要"),
    bullet(`目的地：${payload.trip.destination || "未設定"}`),
    bullet(`日期：${formatDate(payload.trip.startDate)} ～ ${formatDate(payload.trip.endDate)}`),
    bullet(`主要幣別：${payload.trip.currency}`),
    bullet(`成員數：${payload.members.length} 人`),
    bullet(`消費筆數：${payload.expenses.length} 筆`),
    bullet(`已付款紀錄：${completedPayments} 筆`),
    bullet(`總支出：約 ${formatAmount(total, payload.trip.currency)}`),
    ...(payload.trip.description
      ? [paragraph(`旅程說明：${payload.trip.description}`)]
      : []),
  ];
}

function buildMemberBlocks(payload: TripExportPayload): NotionBlock[] {
  return [
    divider(),
    heading("成員"),
    ...payload.members.map((member) => bullet(member.name)),
  ];
}

function buildExpenseTable(payload: TripExportPayload): NotionTableDefinition {
  return {
    title: "消費明細",
    header: ["日期", "說明", "金額", "付款人", "類別", "分帳", "結算", "備註"],
    rows: payload.expenses.map((expense) => {
      const splitSummary = expense.splits
        .map((split) => `${split.member} ${formatAmount(split.amount, expense.currency)}`)
        .join("、");
      const amountText =
        expense.currency === payload.trip.currency
          ? formatAmount(expense.amount, expense.currency)
          : `${formatAmount(expense.amount, expense.currency)} / 約 ${formatAmount(
              expense.amount * expense.exchangeRate,
              payload.trip.currency
            )}`;

      return [
        formatDate(expense.date),
        expense.description,
        amountText,
        expense.paidBy,
        expense.category,
        expense.splitType,
        formatSettlementMode(expense.settlementMode, expense.settlementNote),
        [splitSummary ? `分攤：${splitSummary}` : null, expense.note ? `備註：${expense.note}` : null]
          .filter((part): part is string => Boolean(part))
          .join("；") || "-",
      ];
    }),
  };
}

function buildPaymentTable(payload: TripExportPayload): NotionTableDefinition {
  return {
    title: "付款紀錄",
    header: ["付款人", "收款人", "金額", "狀態", "日期", "備註"],
    rows: payload.payments.map((payment) => [
      payment.from,
      payment.to,
      formatAmount(payment.amount, payment.currency),
      payment.status === "completed" ? "已完成" : payment.status,
      formatDate(payment.settledAt),
      payment.note || "-",
    ]),
  };
}

function buildTableIntroBlocks(payload: TripExportPayload): NotionBlock[] {
  return [
    divider(),
    heading("表格資料"),
    paragraph("下方的消費與付款資料已改為 Notion 原生簡易表格，方便按欄位閱讀。"),
    ...(payload.expenses.length === 0
      ? [paragraph("消費明細目前沒有資料，因此不建立消費表格。")] : []),
    ...(payload.payments.length === 0
      ? [paragraph("付款紀錄目前沒有資料，因此不建立付款表格。")] : []),
  ];
}

function buildNotionPageContent(payload: TripExportPayload): NotionPageContent {
  return {
    introBlocks: [
      ...buildSummaryBlocks(payload),
      ...buildMemberBlocks(payload),
      ...buildTableIntroBlocks(payload),
    ],
    tables: [buildExpenseTable(payload), buildPaymentTable(payload)].filter(
      (table) => table.rows.length > 0
    ),
  };
}

function getNotionConfig() {
  const token = process.env.NOTION_TOKEN?.trim();
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID?.trim();

  if (!token) {
    throw new NotionConfigError("缺少 NOTION_TOKEN，無法匯出到 Notion");
  }

  if (!parentPageId) {
    throw new NotionConfigError("缺少 NOTION_PARENT_PAGE_ID，無法匯出到 Notion");
  }

  return { token, parentPageId };
}

async function notionRequest<TResponse>(
  path: string,
  token: string,
  init: { method: "POST" | "PATCH"; body: Record<string, unknown> },
  attempt = 0
): Promise<TResponse> {
  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(init.body),
  });

  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get("retry-after") || "1");
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return notionRequest<TResponse>(path, token, init, attempt + 1);
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new NotionApiError(errorData?.message || "Notion API 請求失敗");
  }

  return response.json() as Promise<TResponse>;
}

function chunkBlocks(blocks: NotionBlock[]) {
  const chunks: NotionBlock[][] = [];

  for (let index = 0; index < blocks.length; index += MAX_BLOCKS_PER_REQUEST) {
    chunks.push(blocks.slice(index, index + MAX_BLOCKS_PER_REQUEST));
  }

  return chunks;
}

function chunkRows(rows: string[][], size: number) {
  const chunks: string[][][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function appendBlocks(parentBlockId: string, token: string, children: NotionBlock[]) {
  if (children.length === 0) {
    return [] as NotionBlockListResponse["results"];
  }

  const response = await notionRequest<NotionBlockListResponse>(
    `/blocks/${parentBlockId}/children`,
    token,
    {
      method: "PATCH",
      body: {
        children,
      },
    }
  );

  return response.results;
}

async function appendTableToPage(
  pageId: string,
  token: string,
  tableDefinition: NotionTableDefinition
) {
  const createdBlocks = await appendBlocks(pageId, token, [
    heading(tableDefinition.title),
    tableBlock(tableDefinition.header),
  ]);
  const table = createdBlocks.find((block) => block.type === "table");

  if (!table) {
    throw new NotionApiError(`建立 Notion 表格失敗：${tableDefinition.title}`);
  }

  const rowChunks = chunkRows(tableDefinition.rows, MAX_BLOCKS_PER_REQUEST);

  for (const chunk of rowChunks) {
    await appendBlocks(
      table.id,
      token,
      chunk.map((row) => tableRow(row))
    );
  }
}

export async function exportTripToNotion(payload: TripExportPayload) {
  const { token, parentPageId } = getNotionConfig();
  const title = buildPageTitle(payload);
  const pageContent = buildNotionPageContent(payload);
  const [firstChunk = [paragraph("目前沒有可匯出的內容。")], ...remainingChunks] = chunkBlocks(
    pageContent.introBlocks
  );

  const createdPage = await notionRequest<NotionPageResponse>("/pages", token, {
    method: "POST",
    body: {
      parent: {
        page_id: parentPageId,
      },
      icon: payload.trip.coverEmoji
        ? {
            type: "emoji",
            emoji: payload.trip.coverEmoji,
          }
        : undefined,
      properties: {
        title: [
          {
            type: "text",
            text: {
              content: title,
            },
          },
        ],
      },
      children: firstChunk,
    },
  });

  for (const chunk of remainingChunks) {
    await appendBlocks(createdPage.id, token, chunk);
  }

  for (const table of pageContent.tables) {
    await appendTableToPage(createdPage.id, token, table);
  }

  return {
    pageId: createdPage.id,
    pageUrl: createdPage.url,
    title,
  };
}
