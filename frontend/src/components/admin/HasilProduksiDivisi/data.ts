export type JenisPekerjaan = "NORMAL" | "REPAIR";
export type StatusPerpindahan = "TRANSIT" | "DITERIMA" | "SELISIH" | "BATAL";
export type StatusRepair = "MENUNGGU_REPAIR" | "SEDANG_REPAIR" | "MENUNGGU_QC" | "SELESAI" | "REJECT";
export type StatusQcUlang = "BELUM" | "MENUNGGU" | "LULUS" | "REJECT";
export type SumberRepair = "QC" | "INTERNAL";
export type StatusWip =
  | "Menunggu Proses Berikutnya"
  | "Menunggu Decal"
  | "Menunggu Top Coat"
  | "Menunggu Repair"
  | "Sedang Repair"
  | "Menunggu QC"
  | "Menunggu QC Ulang"
  | "Selisih Transit"
  | "Menunggu Pemeriksaan";

export type ItemContoh = { kode: string; nama: string; unit: string };

export interface HasilRow {
  id: number;
  tanggal: string;
  shift: string;
  divisi: string;
  itemKode: string;
  itemNama: string;
  unit: string;
  jenis: JenisPekerjaan;
  diproses: number;
  hasilBaik: number;
  reject: number;
  diserahkan: number;
  catatan: string;
}

export interface Perpindahan {
  id: number;
  nomor: string;
  tanggal: string;
  itemKode: string;
  itemNama: string;
  asal: string;
  tujuan: string;
  dikirim: number;
  diterima: number | null;
  status: StatusPerpindahan;
  catatan: string;
}

export interface Repair {
  id: number;
  nomor: string;
  tanggalPemeriksaan: string;
  itemKode: string;
  itemNama: string;
  jenisCacat: string;
  divisiPenyebab: string;
  // QC = temuan QC akhir, INTERNAL = repair dalam divisi sebelum QC.
  sumber: SumberRepair;
  posisiAsal: string;
  jumlah: number;
  prosesDiulang: string;
  hasilBaik: number;
  rejectAkhir: number;
  status: StatusRepair;
  statusQcUlang: StatusQcUlang;
  catatan: string;
}

// Keputusan QC akhir atas unit fisik di posisi QC. Sumber hasil produksi selesai & reject final.
export interface KeputusanQc {
  id: number;
  tanggal: string;
  itemKode: string;
  itemNama: string;
  jumlah: number;
  hasil: "SELESAI" | "REJECT";
  sumber: "NORMAL" | "REPAIR";
  catatan: string;
}

export interface PosisiWip {
  id: number;
  itemKode: string;
  itemNama: string;
  posisi: string;
  status: StatusWip;
  jenis: JenisPekerjaan;
  jumlah: number;
  sejak: string;
}

export const DIVISI = ["Buffing", "Base Coat", "Decal", "Top Coat", "Perakitan", "QC"];
// Divisi penyebab cacat hanya dari rangkaian proses yang dipantau; QC tidak menjadi penyebab.
export const DIVISI_PROSES = ["Buffing", "Base Coat", "Decal", "Top Coat"];
export const JENIS_CACAT_SARAN = ["Cat belang", "Bekas gores", "Motif kabur", "Debu", "Baret", "Bocor cat"];
export const SHIFT = ["Shift 1", "Shift 2", "Shift 3"];

export const JENIS_LABEL: Record<JenisPekerjaan, string> = {
  NORMAL: "Produksi Normal",
  REPAIR: "Repair",
};

export const STATUS_PINDAH_LABEL: Record<StatusPerpindahan, string> = {
  TRANSIT: "Transit",
  DITERIMA: "Diterima",
  SELISIH: "Selisih",
  BATAL: "Dibatalkan",
};

export const STATUS_REPAIR_LABEL: Record<StatusRepair, string> = {
  MENUNGGU_REPAIR: "Menunggu Repair",
  SEDANG_REPAIR: "Sedang Repair",
  MENUNGGU_QC: "Menunggu QC",
  SELESAI: "Selesai",
  REJECT: "Reject",
};

// Transisi status repair yang sah. Status sama tidak memutasi saldo lagi.
export const TRANSISI_REPAIR: Record<StatusRepair, StatusRepair[]> = {
  MENUNGGU_REPAIR: ["SEDANG_REPAIR", "REJECT"],
  SEDANG_REPAIR: ["MENUNGGU_QC", "REJECT"],
  MENUNGGU_QC: ["SELESAI", "REJECT"],
  SELESAI: ["SELESAI"],
  REJECT: [],
};

export const STATUS_QC_ULANG_LABEL: Record<StatusQcUlang, string> = {
  BELUM: "Belum",
  MENUNGGU: "Menunggu QC Ulang",
  LULUS: "Lulus QC Ulang",
  REJECT: "Reject Akhir",
};

export const BADGE: Record<string, string> = {
  TRANSIT: "bg-amber-100 text-amber-800",
  DITERIMA: "bg-emerald-100 text-emerald-800",
  SELISIH: "bg-red-100 text-red-700",
  BATAL: "bg-slate-100 text-slate-500",
  MENUNGGU_REPAIR: "bg-amber-100 text-amber-800",
  SEDANG_REPAIR: "bg-sky-100 text-sky-800",
  MENUNGGU_QC: "bg-indigo-100 text-indigo-800",
  SELESAI: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-red-100 text-red-700",
  BELUM: "bg-slate-100 text-slate-500",
  MENUNGGU: "bg-amber-100 text-amber-800",
  LULUS: "bg-emerald-100 text-emerald-800",
  "Selisih Transit": "bg-amber-100 text-amber-800",
};

// shortcut: item contoh statis, ganti ke getItems({ divisiId }) saat disambung backend.
export const ITEM_DIVISI: Record<string, ItemContoh[]> = {
  Buffing: [
    { kode: "ITM-BTK-PTH", nama: "Batok Putih", unit: "pcs" },
    { kode: "ITM-BTK-HTM", nama: "Batok Hitam", unit: "pcs" },
  ],
  "Base Coat": [
    { kode: "ITM-BC-PTH", nama: "Batok Putih Base Coat", unit: "pcs" },
    { kode: "ITM-BC-HTM", nama: "Batok Hitam Base Coat", unit: "pcs" },
  ],
  Decal: [
    { kode: "ITM-DCL-SLD", nama: "Batok Decal Solid", unit: "pcs" },
    { kode: "ITM-DCL-MTF", nama: "Batok Decal Motif", unit: "pcs" },
  ],
  "Top Coat": [{ kode: "ITM-TC-BTK", nama: "Batok Top Coat", unit: "pcs" }],
  Perakitan: [{ kode: "ITM-SHG-HLM", nama: "Helm Setengah Jadi", unit: "pcs" }],
  QC: [{ kode: "ITM-FG-HLM", nama: "Helm Finish Good", unit: "pcs" }],
};

export const itemOf = (divisi: string, kode: string): ItemContoh | undefined =>
  (ITEM_DIVISI[divisi] ?? []).find((i) => i.kode === kode);

// Semua item master (dedupe per kode) untuk pilihan QC, karena batok yang diperiksa berasal dari proses sebelumnya.
export const SEMUA_ITEM: ItemContoh[] = [...new Map(Object.values(ITEM_DIVISI).flat().map((i) => [i.kode, i])).values()];

export const hariIni = () => new Date().toLocaleDateString("en-CA");

export const fmtTanggal = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const nextId = (rows: { id: number }[]) => rows.reduce((n, r) => Math.max(n, r.id), 0) + 1;

export function nomorDokumen(prefix: "TRF" | "RPR", tanggal: string, rows: { nomor: string; tanggal: string }[]): string {
  const kode = `${prefix}-${tanggal.replaceAll("-", "")}`;
  const urut = rows.filter((r) => r.tanggal === tanggal && r.nomor.startsWith(kode)).length + 1;
  return `${kode}-${String(urut).padStart(3, "0")}`;
}

// shortcut: data contoh statis, ganti ke endpoint hasil produksi saat disambung backend.
export const HASIL_AWAL: HasilRow[] = [
  { id: 1, tanggal: "2026-10-17", shift: "Shift 1", divisi: "Buffing", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", unit: "pcs", jenis: "NORMAL", diproses: 712, hasilBaik: 700, reject: 12, diserahkan: 700, catatan: "" },
  { id: 2, tanggal: "2026-10-17", shift: "Shift 2", divisi: "Buffing", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", unit: "pcs", jenis: "NORMAL", diproses: 325, hasilBaik: 320, reject: 5, diserahkan: 320, catatan: "" },
  { id: 3, tanggal: "2026-10-17", shift: "Shift 1", divisi: "Base Coat", itemKode: "ITM-BC-PTH", itemNama: "Batok Putih Base Coat", unit: "pcs", jenis: "NORMAL", diproses: 699, hasilBaik: 690, reject: 9, diserahkan: 690, catatan: "" },
  { id: 4, tanggal: "2026-10-17", shift: "Shift 1", divisi: "Decal", itemKode: "ITM-DCL-SLD", itemNama: "Batok Decal Solid", unit: "pcs", jenis: "NORMAL", diproses: 658, hasilBaik: 640, reject: 18, diserahkan: 640, catatan: "Motif ulang" },
  { id: 5, tanggal: "2026-10-17", shift: "Shift 2", divisi: "Top Coat", itemKode: "ITM-TC-BTK", itemNama: "Batok Top Coat", unit: "pcs", jenis: "NORMAL", diproses: 607, hasilBaik: 600, reject: 7, diserahkan: 600, catatan: "" },
  { id: 6, tanggal: "2026-10-18", shift: "Shift 1", divisi: "Buffing", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", unit: "pcs", jenis: "NORMAL", diproses: 822, hasilBaik: 812, reject: 10, diserahkan: 812, catatan: "" },
  { id: 7, tanggal: "2026-10-18", shift: "Shift 1", divisi: "Base Coat", itemKode: "ITM-BC-HTM", itemNama: "Batok Hitam Base Coat", unit: "pcs", jenis: "NORMAL", diproses: 794, hasilBaik: 780, reject: 14, diserahkan: 780, catatan: "" },
  { id: 8, tanggal: "2026-10-18", shift: "Shift 2", divisi: "Decal", itemKode: "ITM-DCL-MTF", itemNama: "Batok Decal Motif", unit: "pcs", jenis: "NORMAL", diproses: 736, hasilBaik: 720, reject: 16, diserahkan: 720, catatan: "" },
  { id: 9, tanggal: "2026-10-18", shift: "Shift 2", divisi: "Top Coat", itemKode: "ITM-TC-BTK", itemNama: "Batok Top Coat", unit: "pcs", jenis: "NORMAL", diproses: 714, hasilBaik: 705, reject: 9, diserahkan: 705, catatan: "" },
  { id: 10, tanggal: "2026-10-18", shift: "Shift 2", divisi: "Perakitan", itemKode: "ITM-SHG-HLM", itemNama: "Helm Setengah Jadi", unit: "pcs", jenis: "NORMAL", diproses: 705, hasilBaik: 700, reject: 5, diserahkan: 700, catatan: "" },
  { id: 11, tanggal: "2026-10-18", shift: "Shift 2", divisi: "QC", itemKode: "ITM-FG-HLM", itemNama: "Helm Finish Good", unit: "pcs", jenis: "NORMAL", diproses: 696, hasilBaik: 685, reject: 11, diserahkan: 685, catatan: "Reject packing" },
  { id: 12, tanggal: "2026-10-18", shift: "Shift 2", divisi: "Decal", itemKode: "ITM-DCL-SLD", itemNama: "Batok Decal Solid", unit: "pcs", jenis: "REPAIR", diproses: 8, hasilBaik: 7, reject: 1, diserahkan: 7, catatan: "Repair pengembalian dari Top Coat, tidak menambah unit baru" },
];

export const PERPINDAHAN_AWAL: Perpindahan[] = [
  { id: 1, nomor: "TRF-20261017-001", tanggal: "2026-10-17", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Decal", tujuan: "Top Coat", dikirim: 40, diterima: 38, status: "SELISIH", catatan: "2 pcs rusak di jalan" },
  { id: 2, nomor: "TRF-20261018-001", tanggal: "2026-10-18", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Base Coat", tujuan: "Decal", dikirim: 60, diterima: 60, status: "DITERIMA", catatan: "" },
  { id: 3, nomor: "TRF-20261019-001", tanggal: "2026-10-19", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", asal: "Base Coat", tujuan: "Decal", dikirim: 8, diterima: null, status: "TRANSIT", catatan: "Menunggu armada" },
];

export const REPAIR_AWAL: Repair[] = [
  {
    id: 1, nomor: "RPR-20261018-001", tanggalPemeriksaan: "2026-10-18", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam",
    jenisCacat: "Bekas gores", divisiPenyebab: "Base Coat", sumber: "QC", posisiAsal: "QC", jumlah: 8, prosesDiulang: "Base Coat",
    hasilBaik: 7, rejectAkhir: 1, status: "SELESAI", statusQcUlang: "LULUS", catatan: "Lolos QC ulang",
  },
  {
    id: 2, nomor: "RPR-20261019-001", tanggalPemeriksaan: "2026-10-19", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih",
    jenisCacat: "Cat belang", divisiPenyebab: "Base Coat", sumber: "QC", posisiAsal: "QC", jumlah: 12, prosesDiulang: "Base Coat",
    hasilBaik: 0, rejectAkhir: 0, status: "SEDANG_REPAIR", statusQcUlang: "BELUM", catatan: "",
  },
  {
    id: 3, nomor: "RPR-20261019-002", tanggalPemeriksaan: "2026-10-19", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih",
    jenisCacat: "Motif kabur", divisiPenyebab: "Decal", sumber: "QC", posisiAsal: "QC", jumlah: 4, prosesDiulang: "Decal",
    hasilBaik: 4, rejectAkhir: 0, status: "MENUNGGU_QC", statusQcUlang: "BELUM", catatan: "Menunggu pemeriksaan QC ulang",
  },
];

// Keputusan QC historis. Reject akhir dari repair dihitung dari rejectAkhir, bukan dari baris ini.
export const KEPUTUSAN_AWAL: KeputusanQc[] = [
  { id: 3, tanggal: "2026-10-19", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", jumlah: 3, hasil: "REJECT", sumber: "NORMAL", catatan: "Bocor cat" },
  { id: 2, tanggal: "2026-10-19", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", jumlah: 7, hasil: "SELESAI", sumber: "REPAIR", catatan: "Lulus QC ulang" },
  { id: 1, tanggal: "2026-10-18", itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", jumlah: 680, hasil: "SELESAI", sumber: "NORMAL", catatan: "" },
];

export const POSISI_AWAL: PosisiWip[] = [
  { id: 1, itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", posisi: "Base Coat", status: "Menunggu Decal", jenis: "NORMAL", jumlah: 50, sejak: "2026-10-18" },
  { id: 2, itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", posisi: "Decal", status: "Menunggu Top Coat", jenis: "NORMAL", jumlah: 40, sejak: "2026-10-19" },
  { id: 3, itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", posisi: "Base Coat", status: "Sedang Repair", jenis: "REPAIR", jumlah: 12, sejak: "2026-10-19" },
  { id: 4, itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", posisi: "Decal", status: "Menunggu QC", jenis: "REPAIR", jumlah: 4, sejak: "2026-10-19" },
  { id: 5, itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", posisi: "QC", status: "Menunggu Pemeriksaan", jenis: "NORMAL", jumlah: 5, sejak: "2026-10-20" },
  { id: 6, itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", posisi: "QC", status: "Menunggu Pemeriksaan", jenis: "NORMAL", jumlah: 20, sejak: "2026-10-20" },
];

// Saldo posisi = sumber WIP. Baris dengan kunci sama digabung supaya tidak double count.
const wipKey = (r: Pick<PosisiWip, "itemKode" | "posisi" | "status" | "jenis">) =>
  `${r.itemKode}|${r.posisi}|${r.status}|${r.jenis}`;

export function gabungWip(rows: PosisiWip[]): PosisiWip[] {
  const map = new Map<string, PosisiWip>();
  for (const r of rows) {
    if (r.jumlah <= 0) continue;
    const key = wipKey(r);
    const cur = map.get(key);
    if (cur) cur.jumlah += r.jumlah;
    else map.set(key, { ...r });
  }
  return [...map.values()];
}

// Transit dihitung sekali sebagai posisi terpisah, tidak dobel dengan saldo divisi.
export const totalTransit = (transfers: Perpindahan[]) =>
  transfers.filter((t) => t.status === "TRANSIT").reduce((n, t) => n + t.dikirim, 0);

export const totalWip = (wip: PosisiWip[], transfers: Perpindahan[]) =>
  gabungWip(wip).reduce((n, r) => n + r.jumlah, 0) + totalTransit(transfers);

export const totalWipByJenis = (wip: PosisiWip[], transfers: Perpindahan[], jenis: JenisPekerjaan) =>
  gabungWip(wip).filter((r) => r.jenis === jenis).reduce((n, r) => n + r.jumlah, 0) +
  (jenis === "NORMAL" ? totalTransit(transfers) : 0);

// Hasil produksi selesai hanya dari keputusan QC akhir yang lulus.
export const totalSelesai = (keputusan: KeputusanQc[]) =>
  keputusan.filter((k) => k.hasil === "SELESAI").reduce((n, k) => n + k.jumlah, 0);

// Reject final = reject saat repair + reject keputusan QC + selisih transit.
// Tidak ada baris yang dihitung dua kali.
export const totalRejectFinal = (keputusan: KeputusanQc[], repairs: Repair[], transfers: Perpindahan[]) =>
  keputusan.filter((k) => k.hasil === "REJECT").reduce((n, k) => n + k.jumlah, 0) +
  repairs.reduce((n, r) => n + r.rejectAkhir, 0) +
  transfers
    .filter((t) => t.status === "SELISIH")
    .reduce((n, t) => n + (t.dikirim - (t.diterima ?? 0)), 0);

export const totalMenungguQcUlang = (wip: PosisiWip[]) =>
  gabungWip(wip).filter((r) => r.status === "Menunggu QC Ulang").reduce((n, r) => n + r.jumlah, 0);

export function kurangiWip(
  rows: PosisiWip[],
  itemKode: string,
  posisi: string,
  qty: number,
  filter: { status?: StatusWip; jenis?: JenisPekerjaan } = {},
): PosisiWip[] | null {
  const cocok = (r: PosisiWip) =>
    r.itemKode === itemKode &&
    r.posisi === posisi &&
    (filter.status === undefined || r.status === filter.status) &&
    (filter.jenis === undefined || r.jenis === filter.jenis);
  const source = rows.filter(cocok);
  const tersedia = source.reduce((n, r) => n + r.jumlah, 0);
  if (qty <= 0 || tersedia < qty) return null;
  let sisa = qty;
  const out: PosisiWip[] = [];
  for (const r of rows) {
    if (sisa > 0 && cocok(r)) {
      const ambil = Math.min(sisa, r.jumlah);
      sisa -= ambil;
      if (r.jumlah - ambil > 0) out.push({ ...r, jumlah: r.jumlah - ambil });
    } else {
      out.push(r);
    }
  }
  return out;
}

export function tambahWip(
  rows: PosisiWip[],
  seed: { itemKode: string; itemNama: string },
  posisi: string,
  status: StatusWip,
  jenis: JenisPekerjaan,
  qty: number,
  sejak: string,
): PosisiWip[] {
  if (qty <= 0) return rows;
  const i = rows.findIndex((r) => r.itemKode === seed.itemKode && r.posisi === posisi && r.status === status && r.jenis === jenis);
  if (i >= 0) {
    const copy = [...rows];
    copy[i] = { ...copy[i], jumlah: copy[i].jumlah + qty };
    return copy;
  }
  return [...rows, { id: nextId(rows), itemKode: seed.itemKode, itemNama: seed.itemNama, posisi, status, jenis, jumlah: qty, sejak }];
}

export const lamaMenunggu = (sejak: string): string => {
  const ms = new Date(`${hariIni()}T00:00:00`).getTime() - new Date(`${sejak}T00:00:00`).getTime();
  const hari = Math.max(0, Math.round(ms / 86_400_000));
  return hari === 0 ? "Hari ini" : `${hari} hari`;
};

// Self-check agregasi WIP: 131 saldo posisi + 8 transit = 139, transit tepat satu kali.
if (import.meta.env.DEV && totalWip(POSISI_AWAL, PERPINDAHAN_AWAL) !== 139) {
  console.error("Self-check WIP gagal: total seharusnya 139");
}
