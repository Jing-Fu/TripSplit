import type { SuggestedSettlement, calculatePersonSettlementGroups } from "@/lib/settlement";
import { formatCurrency } from "@/lib/utils";
import type { Trip } from "./types";

const EXPORT_FONT_STACK = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", system-ui, sans-serif';

type ExportSettlementPDFArgs = {
  trip: Trip;
  totalExpenses: number;
  suggestedSettlements: SuggestedSettlement[];
  personSettlementGroups: ReturnType<typeof calculatePersonSettlementGroups>;
};

export async function exportSettlementPDF({
  trip,
  totalExpenses,
  suggestedSettlements,
  personSettlementGroups,
}: ExportSettlementPDFArgs) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const container = buildSettlementPDFContainer({
    trip,
    totalExpenses,
    suggestedSettlements,
    personSettlementGroups,
  });

  document.body.appendChild(container);

  try {
    const canvas = await renderExportCanvas(container);
    const imageData = canvas.toDataURL("image/png");
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imageHeight = (canvas.height * printableWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = margin;

    doc.addImage(imageData, "PNG", margin, position, printableWidth, imageHeight, undefined, "FAST");
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      position = margin - (imageHeight - heightLeft);
      doc.addPage();
      doc.addImage(imageData, "PNG", margin, position, printableWidth, imageHeight, undefined, "FAST");
      heightLeft -= printableHeight;
    }

    doc.save(`${trip.name}-settlement.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

type ExportSettlementImageArgs = {
  trip: Trip;
  totalExpenses: number;
  suggestedSettlements: SuggestedSettlement[];
};

export async function exportSettlementImage({
  trip,
  totalExpenses,
  suggestedSettlements,
}: ExportSettlementImageArgs) {
  const container = document.createElement("div");
  container.style.cssText = `position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:white;font-family:${EXPORT_FONT_STACK};`;

  const title = document.createElement("h1");
  title.style.cssText = "font-size:24px;margin-bottom:8px;color:#1a1a1a;";
  title.textContent = `${trip.coverEmoji} ${trip.name} 結算明細`;
  container.appendChild(title);

  const meta = document.createElement("p");
  meta.style.cssText = "font-size:14px;color:#666;margin-bottom:24px;";
  meta.textContent = `${trip.members.length} 人 · 總計 ${formatCurrency(totalExpenses, trip.currency)}`;
  container.appendChild(meta);

  if (suggestedSettlements.length > 0) {
    const h2 = document.createElement("h2");
    h2.style.cssText = "font-size:18px;margin-bottom:12px;color:#333;";
    h2.textContent = "待付款結算";
    container.appendChild(h2);

    suggestedSettlements.forEach((s) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:4px;background:#f9fafb;border-radius:8px;font-size:14px;";
      row.innerHTML = `<span>${s.from} → ${s.to}</span><strong>${formatCurrency(s.amount, trip.currency)}</strong>`;
      container.appendChild(row);
    });
  } else {
    const p = document.createElement("p");
    p.style.cssText = "font-size:14px;color:#22c55e;margin-bottom:16px;";
    p.textContent = "✅ 所有款項已結清";
    container.appendChild(p);
  }

  const footer = document.createElement("p");
  footer.style.cssText = "margin-top:24px;font-size:11px;color:#aaa;";
  footer.textContent = `TripSplit · ${new Date().toLocaleDateString("zh-TW")}`;
  container.appendChild(footer);

  document.body.appendChild(container);

  try {
    const canvas = await renderExportCanvas(container);
    const link = document.createElement("a");
    link.download = `${trip.name}-settlement.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}

async function renderExportCanvas(container: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");

  if ("fonts" in document) {
    await document.fonts.ready;
  }

  return html2canvas(container, {
    scale: 2,
    backgroundColor: "#ffffff",
  });
}

function buildSettlementPDFContainer({
  trip,
  totalExpenses,
  suggestedSettlements,
  personSettlementGroups,
}: ExportSettlementPDFArgs) {
  const container = document.createElement("div");
  container.style.cssText = `position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:white;color:#111827;font-family:${EXPORT_FONT_STACK};line-height:1.5;`;

  const title = document.createElement("h1");
  title.style.cssText = "font-size:28px;font-weight:700;margin:0 0 8px;";
  title.textContent = `${trip.coverEmoji} ${trip.name} 結算明細`;
  container.appendChild(title);

  const meta = document.createElement("p");
  meta.style.cssText = "font-size:14px;color:#4b5563;margin:0 0 24px;";
  meta.textContent = `總支出 ${formatCurrency(totalExpenses, trip.currency)} · ${trip.members.length} 位成員 · ${trip.expenses.length} 筆支出`;
  container.appendChild(meta);

  appendSectionHeading(container, "待付款結算");
  if (suggestedSettlements.length === 0) {
    appendNotice(container, "所有款項已結清");
  } else {
    suggestedSettlements.forEach((settlement) => {
      appendSummaryRow(
        container,
        `${settlement.from} → ${settlement.to}`,
        formatCurrency(settlement.amount, trip.currency)
      );
    });
  }

  appendSectionHeading(container, "個人結算摘要");
  personSettlementGroups.forEach((group) => {
    const groupCard = document.createElement("section");
    groupCard.style.cssText = "margin-bottom:16px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;";

    const heading = document.createElement("h3");
    heading.style.cssText = "font-size:18px;font-weight:600;margin:0 0 8px;";
    heading.textContent = group.memberName;
    groupCard.appendChild(heading);

    const totals = document.createElement("p");
    totals.style.cssText = "font-size:14px;color:#4b5563;margin:0 0 12px;";
    totals.textContent = `應付 ${formatCurrency(group.totalToPay, trip.currency)} · 應收 ${formatCurrency(group.totalToReceive, trip.currency)}`;
    groupCard.appendChild(totals);

    if (group.outgoing.length === 0) {
      const settled = document.createElement("p");
      settled.style.cssText = "font-size:14px;color:#16a34a;margin:0;";
      settled.textContent = "目前沒有待付款項";
      groupCard.appendChild(settled);
    } else {
      group.outgoing.forEach((item) => {
        const payment = document.createElement("div");
        payment.style.cssText = "padding:10px 12px;margin-top:8px;border-radius:10px;background:#f9fafb;";

        const main = document.createElement("p");
        main.style.cssText = "font-size:14px;font-weight:600;margin:0 0 4px;";
        main.textContent = `支付給 ${item.to}：${formatCurrency(item.amount, trip.currency)}`;
        payment.appendChild(main);

        if (item.items.length > 0) {
          const details = document.createElement("p");
          details.style.cssText = "font-size:13px;color:#4b5563;margin:0;word-break:break-word;";
          details.textContent = `項目：${item.items.map((expense) => expense.description).join("、")}`;
          payment.appendChild(details);
        }

        groupCard.appendChild(payment);
      });
    }

    container.appendChild(groupCard);
  });

  appendSectionHeading(container, "付款紀錄");
  const completedPayments = trip.payments.filter((payment) => payment.status === "completed");
  if (completedPayments.length === 0) {
    appendNotice(container, "尚未記錄任何付款");
  } else {
    completedPayments.forEach((payment) => {
      const description = payment.note
        ? `${payment.fromMember.name} → ${payment.toMember.name}（${payment.note}）`
        : `${payment.fromMember.name} → ${payment.toMember.name}`;

      appendSummaryRow(container, description, formatCurrency(payment.amount, payment.currency));
    });
  }

  const footer = document.createElement("p");
  footer.style.cssText = "margin:24px 0 0;font-size:11px;color:#9ca3af;";
  footer.textContent = `TripSplit · ${new Date().toLocaleDateString("zh-TW")}`;
  container.appendChild(footer);

  return container;
}

function appendSectionHeading(container: HTMLElement, title: string) {
  const heading = document.createElement("h2");
  heading.style.cssText = "font-size:20px;font-weight:700;margin:0 0 12px;padding-top:8px;";
  heading.textContent = title;
  container.appendChild(heading);
}

function appendSummaryRow(container: HTMLElement, label: string, value: string) {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:12px 14px;margin-bottom:8px;border-radius:12px;background:#f9fafb;";

  const labelElement = document.createElement("span");
  labelElement.style.cssText = "font-size:14px;color:#111827;word-break:break-word;flex:1;";
  labelElement.textContent = label;
  row.appendChild(labelElement);

  const valueElement = document.createElement("strong");
  valueElement.style.cssText = "font-size:14px;color:#111827;white-space:nowrap;";
  valueElement.textContent = value;
  row.appendChild(valueElement);

  container.appendChild(row);
}

function appendNotice(container: HTMLElement, message: string) {
  const notice = document.createElement("p");
  notice.style.cssText = "font-size:14px;color:#16a34a;margin:0 0 16px;";
  notice.textContent = message;
  container.appendChild(notice);
}
