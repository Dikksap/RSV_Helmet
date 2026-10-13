import prisma from "../../lib/prisma.js";
import { TipeStokItem } from "../../../generated/prisma/enums.js";
import { catatMutasi, getSaldo, lockItem } from "../stokItem/stokItem.js";

export type OpnameBarisInput = { itemId: number; stokFisik: number };

export const OPNAME_MAKS_BARIS = 200;

/**
 * Simpan sesi opname massal dalam satu transaksi. Item diurut + dikunci
 * supaya stok sistem dibaca konsisten walau approval berjalan bersamaan.
 * Tiap baris selalu disimpan (termasuk selisih 0); selisih != 0 membuat
 * baris ledger penyeimbang yang terhubung ke baris opname.
 */
export async function buatSesiOpname(
  baris: OpnameBarisInput[],
  keterangan: string | null,
  userId: number | null,
) {
  const urut = [...baris].sort((a, b) => a.itemId - b.itemId);
  return prisma.$transaction(async (tx) => {
    const sesi = await tx.stokOpnameSesi.create({
      data: { keterangan, userId },
    });
    for (const b of urut) {
      await lockItem(tx, b.itemId);
      const sistem = await getSaldo(b.itemId, tx);
      const selisih = b.stokFisik - sistem;
      const row = await tx.stokOpnameBaris.create({
        data: { sesiId: sesi.id, itemId: b.itemId, stokSistem: sistem, stokFisik: b.stokFisik, selisih },
      });
      if (selisih !== 0) {
        await catatMutasi(tx, {
          itemId: b.itemId,
          tipe: selisih > 0 ? TipeStokItem.MASUK : TipeStokItem.KELUAR,
          jumlah: Math.abs(selisih),
          sumberOpnameBarisId: row.id,
          keterangan: `Opname #${sesi.id}: sistem ${sistem} → fisik ${b.stokFisik}`,
          userId,
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
