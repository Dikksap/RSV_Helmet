import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PermintaanBarangRecord } from "../api/permintaanBarang";

const BLACK: [number, number, number] = [11, 11, 11];
const RED: [number, number, number] = [227, 6, 19];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_LINE: [number, number, number] = [215, 224, 238];

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function tanggalID(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function tableEndY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof t?.finalY === "number" ? t.finalY : 40;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text(text.toUpperCase(), 14, y);
  return y + 5;
}

/** Bangun PDF A4 vektor dari record yang sudah tersimpan. */
export function buildPermintaanPdf(rec: PermintaanBarangRecord): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  // ---------- Kepala dokumen ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...BLACK);
  doc.text("RSV", 14, y + 8);
  doc.setFontSize(9);
  doc.text("HELMET INDONESIA", 14, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("PT. HELMINDO PRATAMA INDONESIA", 14, y + 19);
  doc.text("Inventory & Procurement System", 14, y + 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text("FORM PERMINTAAN BARANG", 196, y + 9, { align: "right" });
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...RED);
  doc.text(rec.noPermintaan, 196, y + 15, { align: "right" });

  y += 27;
  doc.setFillColor(...RED);
  doc.rect(14, y, 182, 2.5, "F");
  y += 9;

  // ---------- Informasi dokumen ----------
  y = sectionTitle(doc, "Document Information", y);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    body: [
      ["No. Permintaan", rec.noPermintaan, "Tanggal Form", tanggalID(rec.tanggal)],
      ["Departemen", rec.departemen, "Tgl. Dibutuhkan", tanggalID(rec.tanggalDibutuhkan)],
      ["Peminta", rec.namaPeminta, "Prioritas", rec.prioritas],
      ["Kebutuhan Untuk", rec.kebutuhanUntuk, "", ""],
    ],
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.2 },
    columnStyles: {
      0: { textColor: GRAY, cellWidth: 34 },
      1: { fontStyle: "bold", cellWidth: 57 },
      2: { textColor: GRAY, cellWidth: 34 },
      3: { fontStyle: "bold", cellWidth: 57 },
    },
  });
  y = tableEndY(doc) + 7;

  // ---------- Detail barang ----------
  y = sectionTitle(doc, "Item Details", y);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    head: [["No", "Nama Barang / Bahan", "Spesifikasi", "Jml", "Satuan"]],
    body: rec.items.map((it, i) => [
      String(i + 1).padStart(2, "0"),
      it.nama,
      it.spesifikasi || "-",
      String(it.jumlah),
      it.satuan || "-",
    ]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: LIGHT_LINE, lineWidth: 0.2 },
    headStyles: { fillColor: BLACK, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12, textColor: RED, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "center", cellWidth: 24 },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.fillColor = BLACK;
      }
    },
  });
  y = tableEndY(doc) + 2;
  doc.setFillColor(...RED);
  doc.rect(14, y, 182, 1, "F");
  y += 7;

  // ---------- Alasan ----------
  y = sectionTitle(doc, "Request Reason", y);
  const reasonLines = doc.splitTextToSize(rec.alasan || "-", 178);
  const boxH = Math.max(14, reasonLines.length * 4.5 + 6);
  if (y + boxH > 250) {
    doc.addPage();
    y = 14;
  }
  doc.setDrawColor(...LIGHT_LINE);
  doc.roundedRect(14, y, 182, boxH, 1.5, 1.5, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text(reasonLines, 17, y + 5.5);
  y += boxH + 12;

  // ---------- Tanda tangan ----------
  if (y + 45 > 270) {
    doc.addPage();
    y = 14;
  }
  const sigs = [
    { label: ["Dibuat Oleh", "(PIC)"], name: rec.namaPeminta.toUpperCase() },
    { label: ["Diperiksa Oleh", "(Kepala Produksi)"], name: "" },
    { label: ["Disetujui Oleh", "(Inventori Kontrol)"], name: "" },
  ];
  const colW = 182 / 3;
  doc.setFontSize(8.5);
  sigs.forEach((s, i) => {
    const cx = 14 + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(s.label[0], cx, y, { align: "center" });
    doc.text(s.label[1], cx, y + 4, { align: "center" });
    doc.setDrawColor(...BLACK);
    doc.line(14 + colW * i + 6, y + 34, 14 + colW * (i + 1) - 6, y + 34);
    doc.setFont("helvetica", s.name ? "bold" : "normal");
    doc.setTextColor(...BLACK);
    doc.text(s.name || "(............................)", cx, y + 39, { align: "center" });
  });

  // ---------- Kaki di tiap halaman ----------
  const pages = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(
      `Dokumen ini dicetak dari Sistem Inventaris PT. Helmindo Pratama Indonesia — ${rec.noPermintaan}`,
      105,
      290,
      { align: "center" },
    );
  }

  return doc.output("blob");
}

export function whatsappText(rec: PermintaanBarangRecord): string {
  const pcs = rec.items.reduce((n, it) => n + it.jumlah, 0);
  return (
    `Form Permintaan Barang *${rec.noPermintaan}*\n` +
    `Departemen: ${rec.departemen}\n` +
    `Peminta: ${rec.namaPeminta}\n` +
    `Isi: ${rec.items.length} barang (${pcs} pcs)\n\n` +
    `PDF terlampir.`
  );
}

/**
 * Bagikan file PDF: pakai Web Share API bila bisa (pengguna pilih WhatsApp),
 * kalau tidak: unduh file + buka wa.me dengan teks terisi.
 * Melempar AbortError bila pengguna membatalkan dialog share.
 */
export async function sharePdfFile(
  blob: Blob,
  filename: string,
  text: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const canShareFiles =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: filename, text });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      // Gagal share (mis. desktop tanpa target): lanjut ke fallback unduh.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return "downloaded";
}
