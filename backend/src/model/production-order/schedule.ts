// Penjadwal produksi otomatis — FUNGSI MURNI (tanpa Prisma/io).
// Aturan (disepakati):
// - Senin-Jumat Jam 7, Sabtu Jam 3.5, Minggu libur (Jam 0).
// - Target total tiap tahap = demand master data: decal solid = sum item
//   style Solid, decal motif = sum item style Motif, sisanya = total order.
//   Tanggal akhir bebas: jalan sampai kumulatif = target.
// - Target harian = cap mentah; kumulatif dicap pas target.
// - Alokasi Jumlah harian ikut tahap TOP COAT (kolom TopCoat).
// - Item diurut priority asc, size diurut urutan asc.
// - Hari fixed persiapan & QC+packing: tanpa alokasi (Jumlah 0); budget
//   TOP COAT / PERAKITAN juga tidak diakru di hari itu agar tidak hangus.
// - Jadwal diekor sampai akhir bulan (param akhirBulan YYYY-MM-DD):
//   hari tanpa produksi setelah selesai = "Penyesuaian" (cadangan bila
//   realisasi meleset / ada hutang produksi), tanggal terakhir = "QC & Packing".
// - Alokasi per hari dibulatkan ke kelipatan PCS_PER_DUS (1 dus = 8 pcs).

export const PCS_PER_DUS = 8;

export interface ScheduleItem {
  variantId: number;
  qty: number;
  priority: number;
  style: string;
  color: string;
  size: string;
  sizeUrutan: number;
}

export interface ScheduleCapacity {
  stage: string;
  kapasitasWeekday: number;
  kapasitasSabtu: number;
  mulai: Date | string | null;
  selesai: Date | string | null;
}

export interface ScheduleRow {
  tanggal: string;
  hari: string;
  size: string;
  jam: number;
  buffing: number;
  baseCoat: number;
  decalSolid: number;
  decalMotif: number;
  topCoat: number;
  perakitan: number;
  qc: number;
  item: string;
  jumlah: number;
  variantId: number;
}

export interface ScheduleMeta {
  dialokasikan: number;
  sisa: number;
  hariProduksi: number;
}

// Rincian item per tahap per hari (untuk SPK divisi). Tiap tahap punya
// antreannya sendiri sehingga salip-menyalip antar tahap wajar.
export interface ScheduleStageTake {
  tanggal: string;
  stage: "buffing" | "baseCoat" | "decalSolid" | "decalMotif" | "topCoat" | "perakitan" | "qc";
  variantId: number;
  size: string;
  item: string;
  jumlah: number;
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// ponytail: magic numbers extracted — satu sumber kebenaran, tanpa class berlebih
const WORKING_HOURS = { WEEKDAY: 7, SATURDAY: 3.5, SUNDAY: 0 } as const;
const MAX_GUARD_DAYS = 730; // ~2 tahun, lawan data buntu
const MAX_STALL_DAYS = 30; // hari tanpa progress → stop
const TAIL_BUFFER_DAYS = 93; // ekor Penyesuaian max, lawan input ngawur

function getWorkingHours(dow: number): number {
  if (dow === 0) return WORKING_HOURS.SUNDAY;
  if (dow === 6) return WORKING_HOURS.SATURDAY;
  return WORKING_HOURS.WEEKDAY;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TakeQueue = { sisa: number; label: string; size: string; sizeUrutan: number; variantId: number }[];

// Bagi budget harian ke item urut priority → sizeUrutan. Alokasi penuh
// (terima sisa < 1 dus). Dipakai alokasi utama (topCoat) + rincian tahap.
function allocateTakes(
  budget: number,
  queue: TakeQueue,
): { variantId: number; size: string; item: string; jumlah: number }[] {
  const takes: { variantId: number; size: string; item: string; jumlah: number }[] = [];
  // ponytail: scan O(n) per hari, n kecil (puluhan baris).
  while (budget > 0) {
    const first = queue.find((q) => q.sisa > 0);
    if (!first) break;
    const group = queue
      .filter((q) => q.label === first.label && q.sisa > 0)
      .sort((a, b) => a.sizeUrutan - b.sizeUrutan);
    for (const g of group) {
      if (budget <= 0) break;
      const take = Math.min(budget, g.sisa);
      g.sisa -= take;
      budget -= take;
      takes.push({ variantId: g.variantId, size: g.size, item: first.label, jumlah: take });
    }
  }
  return takes;
}

function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

type StageKey = "buffing" | "baseCoat" | "decalSolid" | "decalMotif" | "topCoat" | "perakitan" | "qc";

function stageKey(stage: string): StageKey | null {
  const s = stage.toUpperCase();
  if (s.includes("BUFFING")) return "buffing";
  if (s.includes("BASE COAT") || s.includes("BASECOAT")) return "baseCoat";
  if (s.includes("DECAL SOLID")) return "decalSolid";
  if (s.includes("DECAL MOTIF")) return "decalMotif";
  if (s.includes("TOP COAT")) return "topCoat";
  if (s.includes("PERAKITAN")) return "perakitan";
  if (s.includes("QC") || s.includes("PACKING")) return "qc";
  return null;
}

export function buildSchedule(
  items: ScheduleItem[],
  capacities: ScheduleCapacity[],
  prepDays: string[],
  qcDays: string[],
  akhirBulan: string | null = null,
  mulaiProduksi: Date | string | null = null,
): { rows: ScheduleRow[]; meta: ScheduleMeta; rincian: ScheduleStageTake[] } {
  const total = items.reduce((n, i) => n + i.qty, 0);
  const styleSum = (kw: string) =>
    items.filter((i) => i.style.toUpperCase().includes(kw)).reduce((n, i) => n + i.qty, 0);
  // Demand per tahap dari master: decal ikut style-nya, sisanya total order.
  const demandOf = (key: StageKey | null) =>
    key === "decalSolid" ? styleSum("SOLID") || total
    : key === "decalMotif" ? styleSum("MOTIF") || total
    : total;

  const caps = capacities
    .map((c) => {
      const key = stageKey(c.stage);
      return {
        key,
        demand: demandOf(key),
        mulai: toDate(c.mulai),
        w: c.kapasitasWeekday,
        s: c.kapasitasSabtu,
        cum: 0,
      };
    })
    .filter((c) => c.key !== null);

  const starts = caps.map((c) => c.mulai).filter((d): d is Date => d !== null);
  if (starts.length === 0 || items.length === 0) {
    return { rows: [], meta: { dialokasikan: 0, sisa: total, hariProduksi: 0 }, rincian: [] };
  }

  const prep = new Set(prepDays);
  const qcPack = new Set(qcDays);

  const queue = [...items]
    .sort((a, b) => a.priority - b.priority || a.variantId - b.variantId)
    .map((i) => ({ ...i, sisa: i.qty, label: `${i.style} ${i.color}` }));

  // Antrean sendiri per tahap berincian: tiap tahap jalan secepat kapasitasnya,
  // salip-menyalip antar tahap wajar (realita lini paralel).
  const stageQueues: { key: ScheduleStageTake["stage"]; q: TakeQueue }[] = (
    ["buffing", "baseCoat", "decalSolid", "decalMotif", "perakitan", "qc"] as const
  ).map((key) => ({ key, q: queue.map((i) => ({ ...i })) }));

  // Alokasi item serentak dibuka pada tanggal mulai produksi order.
  const mulaiGlobal = toDate(mulaiProduksi);
  const allocationOpen = (cur: Date) =>
    mulaiGlobal === null || stripTime(cur) >= stripTime(mulaiGlobal);

  const rows: ScheduleRow[] = [];
  const rincian: ScheduleStageTake[] = [];
  let hariProduksi = 0;
  let stall = 0;

  // Akhir bebas: jalan sampai semua tahap mencapai demand + alokasi habis.
  // Guard 730 hari + stall 30 hari lawan data buntu (cap 0 / demand tak tercapai).
  const d = new Date(Math.min(...starts.map((x) => x.getTime())));
  for (let guard = 0; guard < MAX_GUARD_DAYS; guard++) {
    const cur = new Date(d);
    const tanggal = dayKey(cur);
    const dow = cur.getDay();
    const isSunday = dow === 0;
    const jam = getWorkingHours(dow);
    const isFixed = !isSunday && (prep.has(tanggal) || qcPack.has(tanggal));

    const t: Record<StageKey, number> = { buffing: 0, baseCoat: 0, decalSolid: 0, decalMotif: 0, topCoat: 0, perakitan: 0, qc: 0 };
    if (!isSunday) {
      for (const c of caps) {
        if (!c.key || !c.mulai || stripTime(cur) < stripTime(c.mulai)) continue;
        // TOP COAT / PERAKITAN tidak diakru di hari fixed agar budgetnya tidak hangus.
        if ((c.key === "topCoat" || c.key === "perakitan") && isFixed) continue;
        const rate = dow === 6 ? c.s : c.w;
        const due = Math.min(rate, c.demand - c.cum);
        t[c.key] = Math.max(0, due);
        c.cum += t[c.key];
      }
    }
    const base = {
      tanggal,
      hari: HARI[dow],
      jam,
      buffing: t.buffing,
      baseCoat: t.baseCoat,
      decalSolid: t.decalSolid,
      decalMotif: t.decalMotif,
      topCoat: t.topCoat,
      perakitan: t.perakitan,
      qc: t.qc,
      variantId: 0,
    };

    let allocatedToday = 0;
    const prepOn = t.buffing > 0 || t.baseCoat > 0;
    // Rincian tahap jalan di semua hari non-libur (termasuk hari
    // Persiapan/QC — target agregatnya pun jalan di hari itu).
    // Gerbang mulaiProduksi sama dengan alokasi utama: sebelum dibuka,
    // demand jangan dikonsumsi.
    if (!isSunday && allocationOpen(cur)) {
      for (const sq of stageQueues) {
        if (t[sq.key] <= 0) continue;
        for (const tk of allocateTakes(t[sq.key], sq.q)) {
          rincian.push({ tanggal, stage: sq.key, ...tk });
        }
      }
    }
    if (isSunday) {
      rows.push({ ...base, size: "-", item: "LIBUR", jumlah: 0 });
    } else if (prep.has(tanggal)) {
      const decalOn = t.decalSolid > 0 || t.decalMotif > 0;
      rows.push({ ...base, size: "-", item: prepOn && decalOn ? "Persiapan + Decal" : "Persiapan", jumlah: 0 });
    } else if (qcPack.has(tanggal)) {
      rows.push({ ...base, size: "-", item: "QC & Packing", jumlah: 0 });
    } else {
      let budget = t.topCoat;
      if (budget <= 0) {
        const active = [
          prepOn && "Persiapan",
          (t.decalSolid > 0 || t.decalMotif > 0) && "Decal",
          t.qc > 0 && "QC",
        ].filter((x): x is string => !!x);
        rows.push({ ...base, size: "-", item: active.length > 0 ? active.join(" + ") : "Selesai", jumlah: 0 });
      } else if (!allocationOpen(cur)) {
        // Alokasi belum dibuka: kapasitas hari ini jangan hanguskan demand.
        for (const c of caps) {
          if (c.key) c.cum -= t[c.key];
        }
        rows.push({ ...base, size: "-", item: "Menunggu", jumlah: 0 });
      } else {
        hariProduksi++;
        const takes = allocateTakes(budget, queue);
        for (const tk of takes) rincian.push({ tanggal, stage: "topCoat", ...tk });
        allocatedToday = takes.reduce((n, x) => n + x.jumlah, 0);
        if (takes.length === 0) {
          rows.push({ ...base, size: "-", item: "Selesai", jumlah: 0 });
        } else {
          hariProduksi++;
          // Target hanya di baris pertama hari itu; baris lanjutan = 0 (ikut format sheet).
          const zero = { buffing: 0, baseCoat: 0, decalSolid: 0, decalMotif: 0, topCoat: 0, perakitan: 0, qc: 0 };
          let head = true;
          for (const tk of takes) {
            rows.push({ ...base, ...(head ? {} : zero), size: tk.size, item: tk.item, jumlah: tk.jumlah, variantId: tk.variantId });
            head = false;
          }
        }
      }
    }

    const dayWork = t.buffing + t.baseCoat + t.decalSolid + t.decalMotif + t.topCoat + t.perakitan + t.qc + allocatedToday > 0;
    stall = dayWork ? 0 : stall + 1;
    const stagesDone = caps.every((c) => c.cum >= c.demand);
    const allocDone = queue.every((q) => q.sisa <= 0);
    d.setDate(d.getDate() + 1);
    if ((stagesDone && allocDone) || stall >= MAX_STALL_DAYS) break;
  }

  const sisa = queue.reduce((n, i) => n + i.sisa, 0);
  const dialokasikan = total - sisa;

  // Ekor sampai akhir bulan: tanpa produksi = Penyesuaian, hari terakhir QC & Packing.
  // Jangan sampai bulan berikutnya — sisa produksi masuk meta.sisa.
  if (akhirBulan && /^\d{4}-\d{2}-\d{2}$/.test(akhirBulan) && rows.length > 0) {
    // Potong rows yang melampaui akhir bulan.
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].tanggal > akhirBulan) rows.splice(i, 1);
      else break;
    }
    const akhir = akhirBulan;
    const lastRow = rows[rows.length - 1];
    if (lastRow?.tanggal === akhir && lastRow.jumlah === 0 && lastRow.item !== "LIBUR") {
      lastRow.item = "QC & Packing";
    }
    for (let n = 0; n < TAIL_BUFFER_DAYS; n++) {
      if (dayKey(d) > akhir) break;
      const tanggal = dayKey(d);
      const dow = d.getDay();
      const isSunday = dow === 0;
      const isLast = tanggal === akhir;
      rows.push({
        tanggal,
        hari: HARI[dow],
        size: "-",
        jam: getWorkingHours(dow),
        buffing: 0,
        baseCoat: 0,
        decalSolid: 0,
        decalMotif: 0,
        topCoat: 0,
        perakitan: 0,
        qc: 0,
        item: isSunday ? "LIBUR" : isLast ? "QC & Packing" : "Penyesuaian",
        jumlah: 0,
        variantId: 0,
      });
      d.setDate(d.getDate() + 1);
    }
  }

  return { rows, meta: { dialokasikan, sisa, hariProduksi }, rincian };
}

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Tanggal terakhir bulan periode "YYYY-MM" (null bila tak parseable).
export function endOfPeriode(periode: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(periode);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return dayKey(new Date(y, mo, 0));
}

// Default jangkar dari periode "YYYY-MM": tanpa hari fixed.
// Jadwal murni ikut kapasitas tahap + mulaiProduksi; hari Persiapan /
// QC & Packing fixed hanya bila dikirim eksplisit via ?prep= / ?qc=.
export function defaultAnchors(_periode: string): { prepDays: string[]; qcDays: string[] } {
  return { prepDays: [], qcDays: [] };
}
