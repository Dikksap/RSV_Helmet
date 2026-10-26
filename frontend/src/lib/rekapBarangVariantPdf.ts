import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { BarangRekapVariantRow } from "../api/barang";

const INK: [number, number, number] = [30, 58, 95];
const GRAY: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [229, 233, 240];

type RekapPdfRow = {
  row: BarangRekapVariantRow;
  total: number;
};

type RekapPdfGroup = {
  tanggal: string | null;
  item: string;
  rows: RekapPdfRow[];
  total: number;
};

function formatTanggal(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function downloadRekapBarangVariantPdf(
  groups: RekapPdfGroup[],
  statuses: string[],
  period: string,
  statusLabel: (kode: string) => string,
  filename: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const rows = groups.flatMap((group) => group.rows);
  const totals = statuses.map((kode) =>
    rows.reduce((sum, { row }) => sum + (row.perStatus[kode] ?? 0), 0),
  );
  const grandTotal = rows.reduce((sum, item) => sum + item.total, 0);
  const columnCount = statuses.length + 4;

  const dateBodies: Array<
    Array<Array<string | { content: string; colSpan?: number; rowSpan?: number }>>
  > = [];
  let number = 0;
  for (let dateStart = 0; dateStart < groups.length;) {
    const date = groups[dateStart].tanggal;
    let dateEnd = dateStart + 1;
    while (dateEnd < groups.length && groups[dateEnd].tanggal === date) dateEnd += 1;
    const dateGroups = groups.slice(dateStart, dateEnd);
    const dateRows = dateGroups.flatMap((group) => group.rows);
    const dateTotals = statuses.map((kode) =>
      dateRows.reduce((sum, { row }) => sum + (row.perStatus[kode] ?? 0), 0),
    );
    const dateGrandTotal = dateRows.reduce((sum, item) => sum + item.total, 0);

    const body: Array<
      Array<string | { content: string; colSpan?: number; rowSpan?: number }>
    > = [[
      {
        content: date ? formatTanggal(date) : "Tanpa tanggal",
        colSpan: columnCount,
      },
    ]];
    dateGroups.forEach((group) => {
      group.rows.forEach(({ row }, rowIndex) => {
        number += 1;
        body.push([
          String(number),
          ...(rowIndex === 0
            ? [{ content: group.item, rowSpan: group.rows.length }]
            : []),
          row.size,
          ...statuses.map((kode) =>
            (row.perStatus[kode] ?? 0).toLocaleString("id-ID"),
          ),
          ...(rowIndex === 0
            ? [
                {
                  content: group.total.toLocaleString("id-ID"),
                  rowSpan: group.rows.length,
                },
              ]
            : []),
        ]);
      });
    });
    body.push([
      {
        content: `TOTAL TANGGAL ${date ? formatTanggal(date) : "TANPA TANGGAL"}`,
        colSpan: 3,
      },
      ...dateTotals.map((value) => value.toLocaleString("id-ID")),
      dateGrandTotal.toLocaleString("id-ID"),
    ]);
    dateBodies.push(body);
    dateStart = dateEnd;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("LAPORAN REKAP BARANG PER VARIAN", 14, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Periode: ${period}`, 14, 24);
  doc.text(
    `Status: ${statuses.map(statusLabel).join(", ") || "Semua"}  |  ${rows.length.toLocaleString("id-ID")} varian-hari  |  ${grandTotal.toLocaleString("id-ID")} barang`,
    14,
    30,
  );

  dateBodies.forEach((body, index) => {
    if (index > 0) doc.addPage();
    const isLastDate = index === dateBodies.length - 1;
    autoTable(doc, {
      startY: index === 0 ? 36 : 14,
      margin: { left: 14, right: 14 },
      head: [["No", "Item", "Size", ...statuses.map(statusLabel), "Total per Item"]],
      body,
      ...(isLastDate
        ? {
            foot: [
              [
                { content: "TOTAL", colSpan: 3 },
                ...totals.map((value) => value.toLocaleString("id-ID")),
                grandTotal.toLocaleString("id-ID"),
              ],
            ],
            showFoot: "lastPage" as const,
          }
        : {}),
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: LINE,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [239, 244, 249], textColor: INK, fontStyle: "bold" },
      didParseCell: (data) => {
        if (data.section === "body" && data.cell.colSpan > 1) {
          data.cell.styles.fillColor =
            data.cell.colSpan === columnCount ? [243, 246, 250] : [239, 244, 249];
          data.cell.styles.textColor = INK;
          data.cell.styles.fontStyle = "bold";
        }
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 65 },
        2: { cellWidth: 20 },
        ...Object.fromEntries(
          statuses.map((_, statusIndex) => [
            statusIndex + 3,
            { halign: "right" as const },
          ]),
        ),
        [statuses.length + 3]: {
          halign: "right",
          fontStyle: "bold",
          cellWidth: 28,
        },
      },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1, 2],
    });
  });

  const pages = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.text("RSV Helmet — Laporan Rekap Barang per Varian", 148.5, 203, {
      align: "center",
    });
  }

  doc.save(filename);
}
