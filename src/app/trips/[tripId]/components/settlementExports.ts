import type { SuggestedSettlement, calculatePersonSettlementGroups } from "@/lib/settlement";
import { formatCurrency } from "@/lib/utils";
import type { Trip } from "./types";

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

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  const lineHeight = 7;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(18);
  doc.text(`${trip.name} - Settlement Summary`, margin, y, { maxWidth: contentWidth });
  y += lineHeight * 2;

  doc.setFontSize(11);
  doc.text(`Total: ${formatCurrency(totalExpenses, trip.currency)}`, margin, y);
  y += lineHeight;
  doc.text(`Members: ${trip.members.length}`, margin, y);
  y += lineHeight;
  doc.text(`Expenses: ${trip.expenses.length}`, margin, y);
  y += lineHeight * 2;

  doc.setFontSize(14);
  doc.text("Pending Settlements", margin, y);
  y += lineHeight;

  doc.setFontSize(10);
  if (suggestedSettlements.length === 0) {
    doc.text("No pending settlements.", margin, y);
    y += lineHeight;
  } else {
    suggestedSettlements.forEach((s) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${s.from} -> ${s.to}: ${formatCurrency(s.amount, trip.currency)}`, margin, y);
      y += lineHeight;
    });
  }

  y += lineHeight;
  doc.setFontSize(14);
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.text("Per Person Summary", margin, y);
  y += lineHeight;

  doc.setFontSize(10);
  personSettlementGroups.forEach((group) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.text(group.memberName, margin, y);
    y += lineHeight;
    doc.setFontSize(9);
    doc.text(
      `  To pay: ${formatCurrency(group.totalToPay, trip.currency)} | To receive: ${formatCurrency(group.totalToReceive, trip.currency)}`,
      margin,
      y,
      { maxWidth: contentWidth }
    );
    y += lineHeight;

    group.outgoing.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `    -> ${item.to}: ${formatCurrency(item.amount, trip.currency)} (${item.items.map((e) => e.description).join(", ")})`,
        margin,
        y,
        { maxWidth: contentWidth }
      );
      y += lineHeight;
    });
    y += 2;
  });

  y += lineHeight;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(14);
  doc.text("Payment Records", margin, y);
  y += lineHeight;

  doc.setFontSize(10);
  const completedPayments = trip.payments.filter((p) => p.status === "completed");
  if (completedPayments.length === 0) {
    doc.text("No payments recorded.", margin, y);
  } else {
    completedPayments.forEach((p) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${p.fromMember.name} -> ${p.toMember.name}: ${formatCurrency(p.amount, p.currency)}${p.note ? ` (${p.note})` : ""}`,
        margin,
        y,
        { maxWidth: contentWidth }
      );
      y += lineHeight;
    });
  }

  doc.save(`${trip.name}-settlement.pdf`);
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
  const { default: html2canvas } = await import("html2canvas");
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:white;font-family:system-ui,sans-serif;";

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
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = `${trip.name}-settlement.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}
