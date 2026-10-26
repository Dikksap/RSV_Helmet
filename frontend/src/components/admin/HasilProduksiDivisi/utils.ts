import type { Item } from "../../../api/item";
import type { TipeHasilProduksiItem, WipRow } from "../../../api/hasilProduksiHarian";

export interface BarisForm {
  key: string;
  itemId: string;
  jumlah: string;
  keterangan: string;
}

export interface BarisError {
  itemId?: string;
  jumlah?: string;
}

export interface FormErrors {
  divisi?: string;
  umum?: string;
  input: Record<string, BarisError>;
  hasil: Record<string, BarisError>;
}

export interface RingkasanTipe {
  hasil: number;
  keluar: number;
  masuk: number;
}

export interface RingkasanForm {
  input: number;
  hasil: number;
  selisih: number;
}

export interface KekuranganWip {
  itemId: number;
  jumlah: number;
  wip: number;
  kekurangan: number;
}

let urutanBaris = 0;

export function barisBaru(): BarisForm {
  urutanBaris += 1;
  return {
    key: `baris-${urutanBaris}`,
    itemId: "",
    jumlah: "",
    keterangan: "",
  };
}

export function barisKosong(row: BarisForm): boolean {
  return !row.itemId && !row.jumlah.trim() && !row.keterangan.trim();
}

function validasiDaftar(rows: BarisForm[], target: Record<string, BarisError>) {
  for (const row of rows) {
    const rowError: BarisError = {};
    const itemId = Number(row.itemId);
    const jumlah = Number(row.jumlah);

    if (!Number.isInteger(itemId) || itemId <= 0) rowError.itemId = "Pilih item.";
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      rowError.jumlah = "Jumlah harus bilangan bulat lebih dari 0.";
    }
    if (rowError.itemId || rowError.jumlah) target[row.key] = rowError;
  }
}

export function validasiInputProduksi(
  divisiId: number | null,
  inputRows: BarisForm[],
  hasilRows: BarisForm[],
): FormErrors {
  const errors: FormErrors = { input: {}, hasil: {} };

  if (!divisiId || !Number.isInteger(divisiId) || divisiId <= 0) {
    errors.divisi = "Pilih divisi terlebih dahulu.";
  }
  const inputAktif = inputRows.filter((row) => !barisKosong(row));
  const hasilAktif = hasilRows.filter((row) => !barisKosong(row));

  if (inputAktif.length === 0) errors.umum = "Tambahkan minimal satu item input.";
  else if (hasilAktif.length === 0) errors.umum = "Tambahkan minimal satu item hasil produksi.";

  validasiDaftar(inputAktif, errors.input);
  validasiDaftar(hasilAktif, errors.hasil);
  for (const [rows, target, label] of [
    [inputAktif, errors.input, "input"],
    [hasilAktif, errors.hasil, "hasil"],
  ] as const) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.itemId) continue;
      if (seen.has(row.itemId)) {
        target[row.key] = { ...target[row.key], itemId: `Item ${label} tidak boleh dipilih lebih dari sekali.` };
      }
      seen.add(row.itemId);
    }
  }

  return errors;
}

export function adaError(errors: FormErrors): boolean {
  return Boolean(
    errors.divisi ||
      errors.umum ||
      Object.values(errors.input).some((row) => row.itemId || row.jumlah) ||
      Object.values(errors.hasil).some((row) => row.itemId || row.jumlah),
  );
}

export function totalJumlah(rows: BarisForm[]): number {
  return rows.reduce((total, row) => {
    const jumlah = Number(row.jumlah);
    return Number.isInteger(jumlah) && jumlah > 0 ? total + jumlah : total;
  }, 0);
}

export function ringkasForm(inputRows: BarisForm[], hasilRows: BarisForm[]): RingkasanForm {
  const input = totalJumlah(inputRows);
  const hasil = totalJumlah(hasilRows);
  return { input, hasil, selisih: hasil - input };
}

export function totalPerItem(rows: BarisForm[]): Map<number, number> {
  const total = new Map<number, number>();
  for (const row of rows) {
    const itemId = Number(row.itemId);
    const jumlah = Number(row.jumlah);
    if (!Number.isInteger(itemId) || itemId <= 0) continue;
    if (!Number.isInteger(jumlah) || jumlah <= 0) continue;
    total.set(itemId, (total.get(itemId) ?? 0) + jumlah);
  }
  return total;
}

export function hitungKekuranganWip(
  rows: BarisForm[],
  wip: Record<number, number>,
): KekuranganWip[] {
  return [...totalPerItem(rows)]
    .map(([itemId, jumlah]) => {
      const tersedia = wip[itemId] ?? 0;
      return { itemId, jumlah, wip: tersedia, kekurangan: Math.max(0, jumlah - tersedia) };
    })
    .filter((row) => row.kekurangan > 0);
}

export function formatWip(value: number, unit: string): string {
  const jumlah = value.toLocaleString("id-ID");
  return unit ? `${jumlah} ${unit}` : jumlah;
}

export function tampilkanBarisWip(row: WipRow, itemId: number | null): boolean {
  if (itemId !== null) return true;
  return [row.saldoAwal, row.masuk, row.keluar, row.saldoAkhir].some(
    (value) => angka(value) !== 0,
  );
}

export function ringkasItems(items: { tipe: TipeHasilProduksiItem; jumlah: number | string }[]): RingkasanTipe {
  return items.reduce<RingkasanTipe>(
    (total, item) => {
      const jumlah = Number(item.jumlah);
      if (Number.isFinite(jumlah)) total[ringkasanKey(item.tipe)] += jumlah;
      return total;
    },
    { hasil: 0, keluar: 0, masuk: 0 },
  );
}

function ringkasanKey(tipe: TipeHasilProduksiItem): keyof RingkasanTipe {
  if (tipe === "HASIL") return "hasil";
  if (tipe === "KELUAR") return "keluar";
  return "masuk";
}

export function kelompokkanItem(
  items: Item[],
  divisiId: number | null,
): { utama: Item[]; lain: Item[] } {
  const urut = [...items].sort((a, b) => a.nama.localeCompare(b.nama) || a.id - b.id);
  if (!divisiId) return { utama: [], lain: urut };
  return {
    utama: urut.filter((item) => item.divisiId === divisiId),
    lain: urut.filter((item) => item.divisiId !== divisiId),
  };
}

export function tanggalJakarta(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function hariIni(): string {
  return tanggalJakarta(new Date());
}

export function tanggalSaja(value: string): string {
  return tanggalJakarta(value) || value;
}

export function formatTanggal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function angka(value: number | string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
