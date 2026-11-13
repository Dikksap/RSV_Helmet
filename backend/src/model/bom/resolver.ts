import type { PrismaTransactionClient } from "../../lib/prisma.js";

/**
 * Resolver BOM tunggal untuk seluruh modul.
 *
 * Aturan yang ditegakkan (lihat audit 2026-11):
 * - Hanya BOM `isActive` DAN berlaku pada tanggal bisnis yang dipakai.
 * - `berlakuMulai`/`berlakuSelesai` dihormati (bukan sekadar "ID terbaru").
 * - Jika lebih dari satu BOM memenuhi syarat, transaksi ditolak (ambigu),
 *   bukan memilih salah satu secara diam-diam.
 */
export class BomError extends Error {
  constructor(
    public readonly code:
      | "BOM_NOT_FOUND"
      | "BOM_NOT_EFFECTIVE"
      | "BOM_AMBIGU"
      | "BOM_SIKLIKUS"
      | "BOM_TIDAK_LENGKAP",
    message: string,
  ) {
    super(message);
    this.name = "BomError";
  }
}

export type BomLeafLine = {
  itemId: number;
  kode: string;
  nama: string;
  jenis: string | null;
  unit: string | null;
  quantity: number;
};

export type BomExplosion = {
  bomId: number;
  version: string;
  lines: BomLeafLine[];
  /** true bila ada komponen yang tidak dapat diekspansi (BOM anak tidak ada). */
  incomplete: boolean;
};

const MAX_DEPTH = 12;

const bomInclude = {
  items: {
    orderBy: [{ level: "asc" as const }, { urutan: "asc" as const }, { id: "asc" as const }],
    include: {
      item: { select: { id: true, kode: true, nama: true, jenis: true, unit: true } },
      subassembly: { select: { id: true, kode: true } },
    },
  },
};

function effectiveWhere(tanggal: Date) {
  return {
    isActive: true,
    AND: [
      { OR: [{ berlakuMulai: null }, { berlakuMulai: { lte: tanggal } }] },
      { OR: [{ berlakuSelesai: null }, { berlakuSelesai: { gte: tanggal } }] },
    ],
  };
}

async function pickEffective(
  tx: PrismaTransactionClient,
  where: { productVariantId: number } | { subassemblyId: number },
  tanggal: Date,
  label: string,
) {
  const rows = await tx.bom.findMany({
    where: { ...where, ...effectiveWhere(tanggal) },
    include: bomInclude,
    orderBy: [{ version: "desc" }, { id: "desc" }],
  });
  if (rows.length === 0) {
    const total = await tx.bom.count({ where });
    throw new BomError(
      total > 0 ? "BOM_NOT_EFFECTIVE" : "BOM_NOT_FOUND",
      total > 0
        ? `BOM ${label} ada tetapi tidak berlaku pada ${tanggal.toISOString().slice(0, 10)}`
        : `BOM ${label} tidak ditemukan`,
    );
  }
  if (rows.length > 1) {
    throw new BomError(
      "BOM_AMBIGU",
      `Terdapat ${rows.length} BOM aktif dan berlaku untuk ${label} pada tanggal tersebut; nonaktifkan salah satu`,
    );
  }
  return rows[0];
}

export async function resolveEffectiveBomForVariant(
  tx: PrismaTransactionClient,
  productVariantId: number,
  tanggal: Date,
) {
  return pickEffective(tx, { productVariantId }, tanggal, `variant ${productVariantId}`);
}

export async function resolveEffectiveBomForSubassembly(
  tx: PrismaTransactionClient,
  subassemblyId: number,
  tanggal: Date,
) {
  return pickEffective(tx, { subassemblyId }, tanggal, `subassembly ${subassemblyId}`);
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function explode(
  tx: PrismaTransactionClient,
  bom: Awaited<ReturnType<typeof pickEffective>>,
  factor: number,
  tanggal: Date,
  depth: number,
  ancestors: number[],
  totals: Map<number, BomLeafLine>,
): Promise<boolean> {
  if (depth > MAX_DEPTH) return true;
  let incomplete = false;

  const childrenOf = new Map<number | null, typeof bom.items>();
  for (const item of bom.items) {
    const key = item.parentBomItemId ?? null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), item]);
  }

  const walk = async (parentId: number | null, parentQuantity: number): Promise<void> => {
    for (const component of childrenOf.get(parentId) ?? []) {
      const scrap = component.scrapPercent ? Number(component.scrapPercent) / 100 : 0;
      const quantity = round6(Number(component.quantity) * parentQuantity * (1 + scrap));
      if (quantity <= 0) continue;

      if (component.itemId != null && component.item) {
        const subassembly = await tx.subassembly.findUnique({
          where: { itemId: component.itemId },
          select: { id: true },
        });
        let expandable = false;
        if (subassembly) {
          try {
            const childBom = await resolveEffectiveBomForSubassembly(tx, subassembly.id, tanggal);
            if (ancestors.includes(childBom.id)) {
              throw new BomError(
                "BOM_SIKLIKUS",
                `Siklus BOM terdeteksi pada subassembly ${subassembly.id}`,
              );
            }
            const childIncomplete = await explode(
              tx,
              childBom,
              quantity,
              tanggal,
              depth + 1,
              [...ancestors, childBom.id],
              totals,
            );
            if (childIncomplete) incomplete = true;
            expandable = true;
          } catch (error) {
            if (!(error instanceof BomError)) throw error;
            if (error.code === "BOM_SIKLIKUS") throw error;
            // BOM anak tidak ada / tidak berlaku: komponen ini menjadi daun,
            // tetapi laporan WAJIB menandai bahwa ekspansi tidak lengkap.
            incomplete = true;
          }
        }
        if (!expandable) {
          const current = totals.get(component.itemId);
          totals.set(component.itemId, {
            itemId: component.itemId,
            kode: component.item.kode,
            nama: component.item.nama,
            jenis: component.item.jenis,
            unit: component.unit ?? component.item.unit,
            quantity: round6((current?.quantity ?? 0) + quantity),
          });
        }
        continue;
      }

      if (component.subassemblyId != null) {
        try {
          const childBom = await resolveEffectiveBomForSubassembly(tx, component.subassemblyId, tanggal);
          if (ancestors.includes(childBom.id)) {
            throw new BomError(
              "BOM_SIKLIKUS",
              `Siklus BOM terdeteksi pada subassembly ${component.subassemblyId}`,
            );
          }
          const childIncomplete = await explode(
            tx,
            childBom,
            quantity,
            tanggal,
            depth + 1,
            [...ancestors, childBom.id],
            totals,
          );
          if (childIncomplete) incomplete = true;
        } catch (error) {
          if (!(error instanceof BomError)) throw error;
          if (error.code === "BOM_SIKLIKUS") throw error;
          // BOM anak tidak tersedia/tidak berlaku: tandai tidak lengkap,
          // jangan mengarang kuantitas material daun.
          incomplete = true;
        }
        continue;
      }

      incomplete = true;
    }
  };

  await walk(null, factor);
  return incomplete;
}

/** Kebutuhan teoretis per unit `quantity` output varian pada tanggal bisnis. */
export async function explodeVariantBom(
  tx: PrismaTransactionClient,
  productVariantId: number,
  quantity: number,
  tanggal: Date,
): Promise<BomExplosion> {
  const bom = await resolveEffectiveBomForVariant(tx, productVariantId, tanggal);
  const totals = new Map<number, BomLeafLine>();
  const incomplete = await explode(
    tx,
    bom,
    quantity,
    tanggal,
    0,
    [bom.id],
    totals,
  );
  return {
    bomId: bom.id,
    version: bom.version,
    lines: [...totals.values()].sort((a, b) => a.kode.localeCompare(b.kode)),
    incomplete,
  };
}

/** Kebutuhan teoretis per unit output subassembly (dipakai laporan basis produksi). */
export async function explodeSubassemblyBom(
  tx: PrismaTransactionClient,
  subassemblyId: number,
  quantity: number,
  tanggal: Date,
): Promise<BomExplosion> {
  const bom = await resolveEffectiveBomForSubassembly(tx, subassemblyId, tanggal);
  const totals = new Map<number, BomLeafLine>();
  const incomplete = await explode(
    tx,
    bom,
    quantity,
    tanggal,
    0,
    [bom.id],
    totals,
  );
  return {
    bomId: bom.id,
    version: bom.version,
    lines: [...totals.values()].sort((a, b) => a.kode.localeCompare(b.kode)),
    incomplete,
  };
}
