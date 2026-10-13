import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { TipeStokItem } from "../../../generated/prisma/enums.js";

export type StokMutasiInput = {
  itemId: number;
  tipe: TipeStokItem;
  jumlah: number;
  sumberPermintaanItemId?: number | null;
  sumberOpnameBarisId?: number | null;
  keterangan?: string | null;
  userId?: number | null;
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

export async function catatMutasi(tx: PrismaTransactionClient, input: StokMutasiInput) {
  return tx.stokItemMutasi.create({
    data: {
      itemId: input.itemId,
      tipe: input.tipe,
      jumlah: input.jumlah,
      sumberPermintaanItemId: input.sumberPermintaanItemId ?? null,
      sumberOpnameBarisId: input.sumberOpnameBarisId ?? null,
      keterangan: input.keterangan ?? null,
      userId: input.userId ?? null,
    },
  });
}

export async function listMutasiItem(itemId: number, page: number, limit: number) {
  const [total, data] = await Promise.all([
    prisma.stokItemMutasi.count({ where: { itemId } }),
    prisma.stokItemMutasi.findMany({
      where: { itemId },
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}
