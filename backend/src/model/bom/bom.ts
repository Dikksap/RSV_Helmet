import prisma from "../../lib/prisma.js";

export interface BomFilter {
  q?: string;
  active?: boolean;
  outputType?: "product" | "subassembly";
  productVariantId?: number;
  subassemblyId?: number;
}

export interface BomItemDraft {
  urutan?: number | null;
  itemId?: number | null;
  subassemblyId?: number | null;
  quantity: number;
  unit?: string | null;
  scrapPercent?: number | null;
}

export interface CreateBomInput {
  kode?: string | null;
  nama: string;
  version: string;
  isActive?: boolean;
  berlakuMulai?: Date | null;
  berlakuSelesai?: Date | null;
  productVariantId?: number | null;
  subassemblyId?: number | null;
  items: BomItemDraft[];
}

export interface UpdateBomInput {
  kode?: string | null;
  nama?: string;
  version?: string;
  isActive?: boolean;
  berlakuMulai?: Date | null;
  berlakuSelesai?: Date | null;
  productVariantId?: number | null;
  subassemblyId?: number | null;
  items?: BomItemDraft[];
}

export class BomTidakDitemukanError extends Error {
  readonly code = "BOM_TIDAK_DITEMUKAN";
  constructor() {
    super("BOM tidak ditemukan");
    this.name = "BomTidakDitemukanError";
  }
}

export class BomSiklikusError extends Error {
  readonly code = "BOM_SIKLIKUS";
  constructor() {
    super("Subassembly komponen memanggil kembali output BOM secara siklikus");
    this.name = "BomSiklikusError";
  }
}

const include = {
  productVariant: {
    select: {
      id: true,
      kodeVariant: true,
      productId: true,
      product: { select: { id: true, nama: true, prefix: true } },
    },
  },
  subassembly: {
    select: { id: true, kode: true, nama: true, productVariantId: true },
  },
  items: {
    include: {
      item: { select: { id: true, kode: true, nama: true, unit: true } },
      subassembly: { select: { id: true, kode: true, nama: true } },
    },
    orderBy: [{ urutan: "asc" }, { id: "asc" }],
  },
} as any;

async function componentReachesOutput(sourceId: number, outputId: number, visited = new Set<number>()): Promise<boolean> {
  if (sourceId === outputId) return true;
  if (visited.has(sourceId)) return false;
  visited.add(sourceId);
  const boms = await prisma.bom.findMany({
    where: { subassemblyId: sourceId },
    select: { items: { select: { subassemblyId: true } } },
  });
  for (const bom of boms) {
    for (const item of bom.items) {
      if (item.subassemblyId !== null && item.subassemblyId !== undefined) {
        if (await componentReachesOutput(item.subassemblyId, outputId, visited)) return true;
      }
    }
  }
  return false;
}

async function assertNoSubassemblyCycle(OutputSubassemblyId: number | null | undefined, items: Array<{ subassemblyId?: number | null }>) {
  if (!OutputSubassemblyId) return;
  for (const item of items) {
    if (item.subassemblyId == null) continue;
    if (item.subassemblyId === OutputSubassemblyId) throw new BomSiklikusError();
    if (await componentReachesOutput(item.subassemblyId, OutputSubassemblyId)) throw new BomSiklikusError();
  }
}

export async function listBoms(filter: BomFilter) {
  return prisma.bom.findMany({
    where: {
      ...(filter.q ? { OR: [{ nama: { contains: filter.q } }, { version: { contains: filter.q } }] } : {}),
      ...(filter.active !== undefined ? { isActive: filter.active } : {}),
      ...(filter.productVariantId !== undefined ? { productVariantId: filter.productVariantId } : {}),
      ...(filter.subassemblyId !== undefined ? { subassemblyId: filter.subassemblyId } : {}),
      ...(filter.outputType === "product" ? { subassemblyId: null, productVariantId: { not: null } } : {}),
      ...(filter.outputType === "subassembly" ? { subassemblyId: { not: null } } : {}),
    },
    include,
    orderBy: [{ version: "asc" }, { id: "asc" }],
  });
}

export async function getBomById(id: number) {
  return prisma.bom.findUnique({ where: { id }, include });
}

export async function createBom(data: CreateBomInput) {
  await assertNoSubassemblyCycle(data.subassemblyId ?? null, data.items);
  return prisma.bom.create({
    data: {
      kode: data.kode ?? undefined,
      nama: data.nama,
      version: data.version,
      isActive: data.isActive ?? true,
      berlakuMulai: data.berlakuMulai,
      berlakuSelesai: data.berlakuSelesai,
      productVariant: data.productVariantId ? { connect: { id: data.productVariantId } } : undefined,
      subassembly: data.subassemblyId ? { connect: { id: data.subassemblyId } } : undefined,
      items: {
        create: data.items.map((item) => ({
          ...(item.urutan !== null && item.urutan !== undefined ? { urutan: item.urutan } : {}),
          quantity: item.quantity,

          ...(item.unit !== undefined && item.unit !== null ? { unit: item.unit } : {}),
          ...(item.scrapPercent !== undefined && item.scrapPercent !== null ? { scrapPercent: item.scrapPercent } : {}),
          item: item.itemId ? { connect: { id: item.itemId } } : undefined,
          subassembly: item.subassemblyId ? { connect: { id: item.subassemblyId } } : undefined,
        })),
      },
    },
    include,
  });
}

export async function updateBom(id: number, data: UpdateBomInput) {
  const existing = await prisma.bom.findUnique({ where: { id }, include });
  if (!existing) throw new BomTidakDitemukanError();

  const finalProductVariantId = data.productVariantId === undefined ? existing.productVariantId : data.productVariantId;
  const finalSubassemblyId = data.subassemblyId === undefined ? existing.subassemblyId : data.subassemblyId;
  if ((finalProductVariantId == null && finalSubassemblyId == null) || (finalProductVariantId != null && finalSubassemblyId != null)) {
    throw new Error("Output BOM harus tepat satu: productVariantId atau subassemblyId");
  }

  const itemsForCycle = data.items !== undefined
    ? data.items
    : existing.items.map((item) => ({ subassemblyId: item.subassemblyId }));

  await assertNoSubassemblyCycle(finalSubassemblyId, itemsForCycle);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bom.update({
      where: { id },
      data: {
        ...(data.kode !== undefined ? { kode: data.kode } : {}),
        ...(data.nama !== undefined ? { nama: data.nama } : {}),
        ...(data.version !== undefined ? { version: data.version } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.berlakuMulai !== undefined ? { berlakuMulai: data.berlakuMulai } : {}),
        ...(data.berlakuSelesai !== undefined ? { berlakuSelesai: data.berlakuSelesai } : {}),
        ...(data.productVariantId !== undefined ? { productVariantId: data.productVariantId ?? null } : {}),
        ...(data.subassemblyId !== undefined ? { subassemblyId: data.subassemblyId ?? null } : {}),
      },
      include,
    });
    if (data.items !== undefined) {
      await tx.bomItem.deleteMany({ where: { bomId: id } });
      if (data.items.length > 0) {
        await tx.bomItem.createMany({
          data: data.items.map((item) => ({
            bomId: id,
            ...(item.urutan !== undefined && item.urutan !== null ? { urutan: item.urutan } : {}),
            itemId: item.itemId ?? null,
            subassemblyId: item.subassemblyId ?? null,
            quantity: item.quantity,
            unit: item.unit ?? null,
            scrapPercent: item.scrapPercent === undefined || item.scrapPercent === null ? null : item.scrapPercent,
          })),
        });
      }
    }
    return tx.bom.findUniqueOrThrow({ where: { id }, include });
  });
}

export async function deleteBom(id: number) {
  await prisma.bom.delete({ where: { id } });
}
