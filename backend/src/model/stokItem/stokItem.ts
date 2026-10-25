import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { TipeStokItem } from "../../../generated/prisma/enums.js";

export type StokMutasiInput = {
  itemId: number;
  tipe: TipeStokItem;
  jumlah: number;
  sumberPermintaanItemId?: number | null;
  sumberOpnameBarisId?: number | null;
  sumberHasilProduksiItemId?: number | null;
  keterangan?: string | null;
  userId?: number | null;
  tanggal?: Date;
};

export class StokKurangError extends Error {
  readonly code = "STOK_KURANG";
  constructor(readonly itemId: number, readonly tersedia: number) {
    super(`Stok item ${itemId} tidak cukup (tersedia ${tersedia}).`);
    this.name = "StokKurangError";
  }
}

// Saldo = SUM(MASUK) - SUM(KELUAR). Dihitung dari ledger, tidak ada kolom stok.
export async function getSaldo(itemId: number, tx: PrismaTransactionClient | typeof prisma = prisma): Promise<number> {
  const rows = await tx.stokItemMutasi.groupBy({
    by: ["tipe"],
    where: { itemId },
    _sum: { jumlah: true },
  });
  const masuk = rows.find((r) => r.tipe === "MASUK")?._sum.jumlah ?? 0;
  const keluar = rows.find((r) => r.tipe === "KELUAR")?._sum.jumlah ?? 0;
  return masuk - keluar;
}

// Kunci baris Item supaya dua transaksi approval pada item yang sama
// berjalan berurutan dan tidak membuat saldo minus.
export async function lockItem(tx: PrismaTransactionClient, itemId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM Item WHERE id = ${itemId} FOR UPDATE`;
}

// Saldo banyak item sekaligus (satu query, dipakai modal approval).
export async function getSaldoBulk(itemIds: number[]): Promise<Record<number, number>> {
  const uniq = [...new Set(itemIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (uniq.length === 0) return {};
  const rows = await prisma.stokItemMutasi.groupBy({
    by: ["itemId", "tipe"],
    where: { itemId: { in: uniq } },
    _sum: { jumlah: true },
  });
  const out: Record<number, number> = Object.fromEntries(uniq.map((id) => [id, 0]));
  for (const r of rows) {
    out[r.itemId] += (r.tipe === "MASUK" ? 1 : -1) * (r._sum.jumlah ?? 0);
  }
  return out;
}

// Ringkasan banyak item sekaligus untuk kolom Masuk/Keluar/Net periode di Kelola Item.
export interface RingkasanStokItem {
  masuk: number;
  keluar: number;
  net: number;
}

export async function getRingkasanBulk(
  itemIds: number[],
  rentang: { dari?: Date; sampai?: Date } = {},
): Promise<Record<number, RingkasanStokItem>> {
  const uniq = [...new Set(itemIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (uniq.length === 0) return {};
  const where: { itemId: { in: number[] }; tanggal?: { gte?: Date; lt?: Date } } = { itemId: { in: uniq } };
  if (rentang.dari || rentang.sampai) {
    where.tanggal = {};
    if (rentang.dari) where.tanggal.gte = awalHari(rentang.dari);
    if (rentang.sampai) where.tanggal.lt = awalHari(tambahHari(rentang.sampai, 1));
  }
  const rows = await prisma.stokItemMutasi.groupBy({
    by: ["itemId", "tipe"],
    where,
    _sum: { jumlah: true },
  });
  const out: Record<number, RingkasanStokItem> = Object.fromEntries(
    uniq.map((id) => [id, { masuk: 0, keluar: 0, net: 0 }]),
  );
  for (const r of rows) {
    const jumlah = r._sum.jumlah ?? 0;
    if (r.tipe === "MASUK") out[r.itemId].masuk += jumlah;
    else out[r.itemId].keluar += jumlah;
  }
  for (const id of uniq) {
    out[id].net = out[id].masuk - out[id].keluar;
  }
  return out;
}

export async function catatMutasi(tx: PrismaTransactionClient, input: StokMutasiInput) {
  return tx.stokItemMutasi.create({
    data: {
      itemId: input.itemId,
      tipe: input.tipe,
      jumlah: input.jumlah,
      sumberPermintaanItemId: input.sumberPermintaanItemId ?? null,
      sumberOpnameBarisId: input.sumberOpnameBarisId ?? null,
      sumberHasilProduksiItemId: input.sumberHasilProduksiItemId ?? null,
      keterangan: input.keterangan ?? null,
      userId: input.userId ?? null,
      ...(input.tanggal ? { tanggal: input.tanggal } : {}),
    },
  });
}

function awalHari(tanggal: Date): Date {
  const d = new Date(tanggal);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tambahHari(tanggal: Date, jumlah: number): Date {
  const d = new Date(tanggal);
  d.setDate(d.getDate() + jumlah);
  return d;
}

export async function listMutasiItem(
  itemId: number,
  page: number,
  limit: number,
  rentang: { dari?: Date; sampai?: Date } = {},
) {
  const where: { itemId: number; tanggal?: { gte?: Date; lt?: Date } } = { itemId };
  if (rentang.dari || rentang.sampai) {
    where.tanggal = {};
    if (rentang.dari) where.tanggal.gte = awalHari(rentang.dari);
    if (rentang.sampai) where.tanggal.lt = awalHari(tambahHari(rentang.sampai, 1));
  }
  const [total, data] = await Promise.all([
    prisma.stokItemMutasi.count({ where }),
    prisma.stokItemMutasi.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}
