// Kalkulasi selesai + hari kerja dari target — FUNGSI MURNI.
// Aturan sama dengan schedule backend: Minggu libur, Sabtu pakai kapS.

export interface CalcInput {
  mulai: string; // YYYY-MM-DD
  kapW: number;
  kapS: number;
  target: number;
}

export interface CalcResult {
  selesai: string; // YYYY-MM-DD
  hariKerja: number;
}

function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calcSelesai(input: CalcInput): CalcResult | null {
  const { kapW, kapS, target } = input;
  const start = parseDay(input.mulai);
  if (!start) return null;
  if (!Number.isFinite(target) || target <= 0) return null;
  if (kapW < 0 || kapS < 0 || (kapW === 0 && kapS === 0)) return null;

  let acc = 0;
  let hariKerja = 0;
  const d = new Date(start);
  // ponytail: guard 5 tahun, target tak tercapai = data salah.
  for (let i = 0; i < 1826; i++) {
    if (d.getDay() !== 0) {
      acc += d.getDay() === 6 ? kapS : kapW;
      hariKerja++;
      if (acc >= target) return { selesai: dayKey(d), hariKerja };
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// Kebutuhan kap/hari agar target tercapai tepat waktu dalam [mulai, selesai].
// Sabtu setengah rate (dibulatkan ke atas), Minggu libur.
export interface RequiredDaily {
  kapW: number;
  kapS: number;
  hari: number;
}

export function requiredDaily(mulai: string, selesai: string, target: number): RequiredDaily | null {
  const m = parseDay(mulai);
  const s = parseDay(selesai);
  if (!m || !s || s < m || target < 0) return null;
  let wd = 0;
  let sat = 0;
  for (let d = new Date(m); d <= s; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue;
    if (d.getDay() === 6) sat++;
    else wd++;
  }
  const hari = wd + sat;
  if (hari === 0) return null;
  const kapW = target === 0 ? 0 : Math.ceil(target / (wd + sat / 2));
  const kapS = Math.ceil(kapW / 2);
  return { kapW, kapS, hari };
}

export interface DemandItem {
  qty: number;
  style: string;
}

// Target default per tahap: decal ikut demand style-nya, sisanya total order.
export function demandForStage(stage: string, items: DemandItem[], totalQty: number): number {
  const s = stage.toUpperCase();
  const kw = s.includes("DECAL SOLID") ? "SOLID" : s.includes("DECAL MOTIF") ? "MOTIF" : null;
  if (!kw) return totalQty;
  const sum = items
    .filter((i) => i.style.toUpperCase().includes(kw))
    .reduce((n, i) => n + i.qty, 0);
  return sum > 0 ? sum : totalQty;
}
