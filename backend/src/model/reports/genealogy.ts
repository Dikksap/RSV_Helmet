import prisma from "../../lib/prisma.js";

/**
 * Ekspansi genealogi lot sampai material daun.
 *
 * Aturan:
 * - Satu lot output dibagi ke seluruh output run secara proporsional
 *   (`jumlah konsumsi / total output run`), sehingga split/merge lot tetap
 *   dapat diaudit dan tidak memakai pembagian sederhana per lot.
 * - Lot yang TIDAK punya baris produksi (berasal dari permintaan/penerimaan)
 *   adalah material daun; item setengah jadi yang diproduksi tidak pernah
 *   muncul sebagai daun sehingga tidak dihitung dua kali.
 * - Bila genealogi tidak lengkap, hasil ditandai `incomplete` — angka tidak
 *   dikarang dan histori tidak diubah.
 */

export type LeafInfo = {
  itemId: number;
  kode: string;
  nama: string;
  jenis: string | null;
  unit: string | null;
};

export type LeafQuantity = LeafInfo & { quantity: number };

export type LotRun = {
  id: number;
  nomor: string;
  tanggalProduksi: Date;
  totalOutput: number;
  consumptions: Array<{ lotId: number; jumlah: number }>;
};

export type LotNode = {
  id: number;
  itemId: number;
  item: LeafInfo;
  jumlahDiterima: number;
  hasilProduksiHarianItemId: number | null;
  run: LotRun | null;
  /** Lot asal bila lot ini lahir dari transfer WIP (bukan produksi). */
  transferSources: Array<{ lotId: number; jumlah: number }>;
};

export interface LotGraphLoader {
  loadLot(lotId: number): Promise<LotNode | null>;
}

export type LotLeafResult = {
  /** Kuantitas material daun untuk SATU unit lot ini. */
  leaves: Map<number, LeafQuantity>;
  incomplete: boolean;
};

export function createPrismaLotGraphLoader(): LotGraphLoader {
  return {
    async loadLot(lotId: number): Promise<LotNode | null> {
      const lot = await prisma.pemakaianMaterialItem.findUnique({
        where: { id: lotId },
        select: {
          id: true,
          itemId: true,
          jumlahDiterima: true,
          hasilProduksiHarianItemId: true,
          item: { select: { id: true, kode: true, nama: true, jenis: true, unit: true } },
        },
      });
      if (!lot || lot.itemId === null || !lot.item) return null;

      let run: LotRun | null = null;
      if (lot.hasilProduksiHarianItemId !== null) {
        const line = await prisma.hasilProduksiHarianItem.findUnique({
          where: { id: lot.hasilProduksiHarianItemId },
          select: {
            hasilProduksiHarianId: true,
            hasilProduksiHarian: {
              select: {
                id: true,
                nomor: true,
                tanggalProduksi: true,
                items: { where: { tipe: "HASIL" }, select: { jumlah: true } },
              },
            },
          },
        });
        if (line) {
          const consumptions = await prisma.hasilProduksiPemakaian.findMany({
            where: {
              hasilProduksiHarianItem: { hasilProduksiHarianId: line.hasilProduksiHarianId },
            },
            select: { pemakaianMaterialItemId: true, jumlah: true },
          });
          run = {
            id: line.hasilProduksiHarian.id,
            nomor: line.hasilProduksiHarian.nomor,
            tanggalProduksi: line.hasilProduksiHarian.tanggalProduksi,
            totalOutput: line.hasilProduksiHarian.items.reduce(
              (total, row) => total + Number(row.jumlah),
              0,
            ),
            consumptions: consumptions.map((row) => ({
              lotId: row.pemakaianMaterialItemId,
              jumlah: Number(row.jumlah),
            })),
          };
        }
      }

      const transferItem = await prisma.wipTransferItem.findFirst({
        where: { pemakaianMaterialItemId: lot.id },
        select: {
          id: true,
          alokasi: { select: { pemakaianMaterialItemId: true, jumlah: true } },
        },
      });
      const transferSources =
        transferItem?.alokasi.map((row) => ({
          lotId: row.pemakaianMaterialItemId,
          jumlah: Number(row.jumlah),
        })) ?? [];

      return {
        id: lot.id,
        itemId: lot.itemId,
        item: {
          itemId: lot.item.id,
          kode: lot.item.kode,
          nama: lot.item.nama,
          jenis: lot.item.jenis,
          unit: lot.item.unit,
        },
        jumlahDiterima: Number(lot.jumlahDiterima),
        hasilProduksiHarianItemId: lot.hasilProduksiHarianItemId,
        run,
        transferSources,
      };
    },
  };
}

const MAX_DEPTH = 12;

export async function unitLeaves(
  loader: LotGraphLoader,
  lotId: number,
  cache: Map<number, LotLeafResult> = new Map(),
  path: number[] = [],
  depth = 0,
): Promise<LotLeafResult> {
  const cached = cache.get(lotId);
  if (cached) return cached;

  const lot = await loader.loadLot(lotId);
  if (!lot) {
    return { leaves: new Map(), incomplete: true };
  }

  const asSource: LotLeafResult = {
    leaves: new Map([
      [
        lot.itemId,
        {
          itemId: lot.itemId,
          kode: lot.item.kode,
          nama: lot.item.nama,
          jenis: lot.item.jenis,
          unit: lot.item.unit,
          quantity: 1,
        },
      ],
    ]),
    incomplete: false,
  };

  if (depth > MAX_DEPTH || path.includes(lotId)) {
    return { leaves: asSource.leaves, incomplete: true };
  }
  // Lot hasil transfer: lanjutkan genealogi ke lot asal, karena transfer bukan
  // titik awal material dan bukan konsumsi tambahan.
  if ((!lot.run || lot.run.totalOutput <= 0) && lot.transferSources.length > 0) {
    const totalSumber = lot.transferSources.reduce((total, row) => total + row.jumlah, 0);
    const basis = lot.jumlahDiterima > 0 ? lot.jumlahDiterima : totalSumber;
    if (basis <= 0) return { leaves: new Map(), incomplete: true };
    const leaves = new Map<number, LeafQuantity>();
    let incomplete = false;
    for (const source of lot.transferSources) {
      const sub = await unitLeaves(loader, source.lotId, cache, [...path, lotId], depth + 1);
      if (sub.incomplete) incomplete = true;
      const factor = source.jumlah / basis;
      for (const [itemId, leaf] of sub.leaves) {
        const current = leaves.get(itemId);
        leaves.set(itemId, { ...leaf, quantity: (current?.quantity ?? 0) + leaf.quantity * factor });
      }
    }
    const result: LotLeafResult = { leaves, incomplete };
    cache.set(lotId, result);
    return result;
  }
  if (!lot.run || lot.run.totalOutput <= 0) {
    return asSource;
  }

  const run = lot.run;
  const leaves = new Map<number, LeafQuantity>();
  let incomplete = false;

  for (const consumption of run.consumptions) {
    const share = consumption.jumlah / run.totalOutput;
    if (share <= 0) continue;
    const sub = await unitLeaves(loader, consumption.lotId, cache, [...path, lotId], depth + 1);
    if (sub.incomplete) incomplete = true;
    for (const [itemId, leaf] of sub.leaves) {
      const current = leaves.get(itemId);
      leaves.set(itemId, {
        ...leaf,
        quantity: (current?.quantity ?? 0) + leaf.quantity * share,
      });
    }
  }

  const result: LotLeafResult = { leaves, incomplete };
  cache.set(lotId, result);
  return result;
}

export type LotConsumption = {
  quantity: number;
  leaves: LeafQuantity[];
  incomplete: boolean;
};

/** Material daun untuk sejumlah `quantity` unit dari sebuah lot. */
export async function leavesForLotQuantity(
  loader: LotGraphLoader,
  lotId: number,
  quantity: number,
  cache?: Map<number, LotLeafResult>,
): Promise<LotConsumption> {
  const result = await unitLeaves(loader, lotId, cache);
  return {
    quantity,
    leaves: [...result.leaves.values()]
      .map((leaf) => ({ ...leaf, quantity: round6(leaf.quantity * quantity) }))
      .sort((a, b) => a.kode.localeCompare(b.kode)),
    incomplete: result.incomplete,
  };
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function mergeLeafMaps(target: Map<number, LeafQuantity>, source: Iterable<LeafQuantity>) {
  for (const leaf of source) {
    const current = target.get(leaf.itemId);
    target.set(leaf.itemId, {
      ...leaf,
      quantity: round6((current?.quantity ?? 0) + leaf.quantity),
    });
  }
}
