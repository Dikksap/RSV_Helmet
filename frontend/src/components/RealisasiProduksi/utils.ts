import { REALISASI_STAGE_LABEL } from "../../api/productionOrders";

export const STAGE_KEYS = Object.keys(REALISASI_STAGE_LABEL);
export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + delta);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
export function hariOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return HARI[new Date(y, m - 1, d).getDay()];
}
export function monthRange(periode: string | null): [string, string] {
  const m = /^(\d{4})-(\d{2})/.exec(periode ?? "");
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const mo = m ? Number(m[2]) : new Date().getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, mo, 0).getDate();
  return [`${y}-${pad(mo)}-01`, `${y}-${pad(mo)}-${pad(last)}`];
}
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
export function eachDay(awal: string, akhir: string): string[] {
  const out: string[] = [];
  let t = awal;
  for (let n = 0; n < 93 && t <= akhir; n++) {
    out.push(t);
    t = shiftDay(t, 1);
  }
  return out;
}
export function statusOf(rencana: number, aktual: number): { text: string; cls: string } {
  if (rencana === 0 && aktual === 0) return { text: "—", cls: "bg-slate-100 text-slate-500" };
  if (aktual === rencana) return { text: "Tercapai", cls: "bg-emerald-100 text-emerald-800" };
  if (aktual < rencana) return { text: `Kurang ${(rencana - aktual).toLocaleString("id-ID")}`, cls: "bg-red-100 text-red-700" };
  return { text: `Lebih ${(aktual - rencana).toLocaleString("id-ID")}`, cls: "bg-sky-100 text-sky-800" };
}
export function mode(vals: number[]): number {
  if (vals.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
