import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { groupReportItems, type ScanReportItem } from "./scanReport";

const INK: [number, number, number] = [15, 28, 46];
const GRAY: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [229, 233, 240];

function tableEndY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof t?.finalY === "number" ? t.finalY : 40;
}

export function downloadScanReportPdf(
  items: ScanReportItem[],
  tanggal: string,
  dateKey: string,
  statusLabel: (kode: string) => string,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("LAPORAN SCAN HARIAN", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`Tanggal: ${tanggal}`, 14, 25);
  doc.text(`Total: ${items.length} item`, 14, 31);

  const groups = groupReportItems(items);

  autoTable(doc, {
    startY: 40,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    head: [["Varian", "Status", "Jumlah"]],
    body: groups.map((g) => [g.variant, statusLabel(g.status), String(g.jumlah)]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      1: { cellWidth: 40 },
      2: { halign: "right", cellWidth: 22, fontStyle: "bold" },
    },
  });

  autoTable(doc, {
    startY: tableEndY(doc) + 6,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    head: [["No", "Kode", "Varian", "Status", "Jam", "Dus"]],
    body: items.map((it, i) => [
      String(i + 1),
      it.kode,
      it.variant,
      statusLabel(it.status),
      it.waktu,
      it.dus ?? "-",
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 34 },
      3: { cellWidth: 26 },
      4: { halign: "center", cellWidth: 18 },
      5: { cellWidth: 20 },
    },
  });

  const pages = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(`RSV Helmet — Laporan scan ${tanggal}`, 105, 290, { align: "center" });
  }

  doc.save(`laporan-scan-${dateKey}.pdf`);
}
