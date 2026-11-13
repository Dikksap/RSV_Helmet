import prisma from "../../lib/prisma.js";
import { awalHariBisnis } from "../../lib/tanggalBisnis.js";
import { getItemStockTotal, postInventoryMovementInTransaction } from "../inventory/inventory.js";
import { lockItem } from "../stokItem/stokItem.js";

export type OpnameBarisInput = { itemId: number; stokFisik: number };

export const OPNAME_MAKS_BARIS = 200;

export class OpnameError extends Error {
  constructor(
    public readonly code:
      | "ITEM_TIDAK_DITEMUKAN"
      | "LOKASI_DEFAULT_BELUM_DISET"
      | "BARIS_TIDAK_VALID",
    message: string,
  ) {
    super(message);
    this.name = "OpnameError";
  }
}

/**
 * Simpan sesi opname massal dalam satu transaksi.
 *
 * Saldo sistem dibaca dari ledger lokasi (`StockBalance`) — bukan lagi
 * `StokItemMutasi`. Selisih diposting sebagai `InventoryMovement` ADJUSTMENT
 * pada lokasi default item, sehingga opname memakai ledger yang sama dengan
 * seluruh transaksi operasional (tidak ada ledger kedua).
 */
export async function buatSesiOpname(
  baris: OpnameBarisInput[],
  keterangan: string | null,
  userId: number | null,
  tanggal?: Date | null,
) {
  const urut = [...baris].sort((a, b) => a.itemId - b.itemId);
  const tanggalBisnis = awalHariBisnis(tanggal ?? new Date());
  return prisma.$transaction(async (tx) => {
    const sesi = await tx.stokOpnameSesi.create({
      data: { keterangan, userId, tanggal: tanggalBisnis },
    });
    for (const b of urut) {
      await lockItem(tx, b.itemId);
      const item = await tx.item.findUnique({
        where: { id: b.itemId },
        select: { id: true, kode: true, defaultInventoryLocationId: true },
      });
      if (!item) {
        throw new OpnameError("ITEM_TIDAK_DITEMUKAN", `Item ${b.itemId} tidak ditemukan`);
      }
      if (item.defaultInventoryLocationId === null) {
        throw new OpnameError(
          "LOKASI_DEFAULT_BELUM_DISET",
          `Item ${item.kode} belum punya lokasi default; opname tidak dapat diposting ke ledger lokasi`,
        );
      }
      const sistem = Math.round(await getItemStockTotal(tx, b.itemId));
      const selisih = b.stokFisik - sistem;
      const row = await tx.stokOpnameBaris.create({
        data: {
          sesiId: sesi.id,
          itemId: b.itemId,
          stokSistem: sistem,
          stokFisik: b.stokFisik,
          selisih,
        },
      });
      if (selisih !== 0) {
        await postInventoryMovementInTransaction(tx, {
          itemId: b.itemId,
          ...(selisih > 0
            ? { toLocationId: item.defaultInventoryLocationId }
            : { fromLocationId: item.defaultInventoryLocationId }),
          type: "ADJUSTMENT",
          quantity: Math.abs(selisih),
          idempotencyKey: `stok-opname:${sesi.id}:${row.id}`,
          sourceType: "STOK_OPNAME",
          sourceId: `${sesi.id}:${row.id}`,
          reason: `Opname #${sesi.id}: sistem ${sistem} → fisik ${b.stokFisik}`,
          userId,
          occurredAt: tanggalBisnis,
        });
      }
    }
    return tx.stokOpnameSesi.findUniqueOrThrow({
      where: { id: sesi.id },
      include: { baris: { include: { item: true } } },
    });
  });
}

export async function listSesiOpname(page: number, limit: number) {
  const [total, data] = await Promise.all([
    prisma.stokOpnameSesi.count(),
    prisma.stokOpnameSesi.findMany({
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { baris: true } },
        baris: { select: { selisih: true } },
      },
    }),
  ]);
  const ringkas = data.map((s) => {
    const { baris, _count, ...rest } = s;
    return {
      ...rest,
      jumlahBaris: _count.baris,
      totalPlus: baris.filter((b) => b.selisih > 0).reduce((n, b) => n + b.selisih, 0),
      totalMinus: baris.filter((b) => b.selisih < 0).reduce((n, b) => n + b.selisih, 0),
    };
  });
  return { data: ringkas, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function getSesiOpnameById(id: number) {
  return prisma.stokOpnameSesi.findUnique({
    where: { id },
    include: { baris: { include: { item: true } }, user: { select: { id: true, name: true } } },
  });
}
