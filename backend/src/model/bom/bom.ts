import prisma from "../../lib/prisma.js";
import type { PrismaTransactionClient } from "../../lib/prisma.js";

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
  children?: BomItemDraft[];
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
      style: { select: { nama: true } },
      color: { select: { nama: true } },
      size: { select: { nama: true } },
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
    orderBy: [{ level: "asc" }, { urutan: "asc" }, { id: "asc" }],
  },
} as any;

interface BomItemRecord {
  id: number;
  bomId: number;
  parentBomItemId: number | null;
  level: number;
}

type BomItemNode = BomItemRecord & { children: BomItemNode[] };
type BomWithItems = { items: BomItemRecord[] };

function nestBomItems(items: BomItemRecord[]): BomItemNode[] {
  const nodes = items.map((item) => ({ ...item, children: [] as BomItemNode[] }));
  const nodesById = new Map(nodes.map((item) => [item.id, item]));
  const roots: BomItemNode[] = [];

  for (const node of nodes) {
    if (node.parentBomItemId === null) {
      if (node.level !== 1) throw new Error(`Level BOM tidak valid pada komponen ${node.id}`);
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(node.parentBomItemId);
    if (!parent || parent.bomId !== node.bomId) {
      throw new Error(`Parent komponen BOM ${node.parentBomItemId} tidak ditemukan pada BOM yang sama`);
    }
    if (node.level !== parent.level + 1) {
      throw new Error(`Level komponen BOM ${node.id} tidak sesuai dengan parent-nya`);
    }
    parent.children.push(node);
  }

  return roots;
}

function withItemTree<T extends BomWithItems>(bom: T) {
  return { ...bom, items: nestBomItems(bom.items) };
}

function flattenItems<T extends { children?: T[] }>(items: T[]): T[] {
  return items.flatMap((item) => [item, ...flattenItems(item.children ?? [])]);
}

async function createBomItemTree(
  tx: PrismaTransactionClient,
  bomId: number,
  items: BomItemDraft[],
  parentBomItemId: number | null = null,
  level = 1,
) {
  for (const item of items) {
    const created = await tx.bomItem.create({
      data: {
        bomId,
        parentBomItemId,
        level,
        ...(item.urutan !== undefined && item.urutan !== null ? { urutan: item.urutan } : {}),
        itemId: item.itemId ?? null,
        subassemblyId: item.subassemblyId ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        scrapPercent: item.scrapPercent ?? null,
      },
      select: { id: true },
    });
    await createBomItemTree(tx, bomId, item.children ?? [], created.id, level + 1);
  }
}

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
  const rows = await prisma.bom.findMany({
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
  return (rows as unknown as Array<(typeof rows)[number] & BomWithItems>).map(withItemTree);
}

export async function getBomById(id: number) {
  const row = await prisma.bom.findUnique({ where: { id }, include });
  return row ? withItemTree(row as typeof row & BomWithItems) : null;
}

export async function createBom(data: CreateBomInput) {
  await assertNoSubassemblyCycle(data.subassemblyId ?? null, flattenItems(data.items));
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.bom.create({
        data: {
          kode: data.kode ?? undefined,
          nama: data.nama,
          version: data.version,
          isActive: data.isActive ?? true,
          berlakuMulai: data.berlakuMulai,
          berlakuSelesai: data.berlakuSelesai,
          productVariant: data.productVariantId ? { connect: { id: data.productVariantId } } : undefined,
          subassembly: data.subassemblyId ? { connect: { id: data.subassemblyId } } : undefined,
        },
        select: { id: true },
      });
      await createBomItemTree(tx, created.id, data.items);
      const row = await tx.bom.findUniqueOrThrow({ where: { id: created.id }, include });
      return withItemTree(row as typeof row & BomWithItems);
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;

    const outputWhere = data.productVariantId != null
      ? { productVariantId: data.productVariantId, version: data.version }
      : data.subassemblyId != null
        ? { subassemblyId: data.subassemblyId, version: data.version }
        : null;
    if (!outputWhere) throw error;

    const existing = await prisma.bom.findFirst({
      where: outputWhere,
      select: { id: true },
    });
    if (!existing) {
      if (!data.kode) throw error;
      const codeOwner = await prisma.bom.findUnique({
        where: { kode: data.kode },
        select: { id: true },
      });
      if (!codeOwner) throw error;
      return createBom({ ...data, kode: null });
    }

    return updateBom(existing.id, data);
  }
}

export async function updateBom(id: number, data: UpdateBomInput) {
  const existing = await prisma.bom.findUnique({ where: { id }, include });
  if (!existing) throw new BomTidakDitemukanError();

  const finalProductVariantId = data.productVariantId === undefined ? existing.productVariantId : data.productVariantId;
  const finalSubassemblyId = data.subassemblyId === undefined ? existing.subassemblyId : data.subassemblyId;
  if ((finalProductVariantId == null && finalSubassemblyId == null) || (finalProductVariantId != null && finalSubassemblyId != null)) {
    throw new Error("Output BOM harus tepat satu: productVariantId atau subassemblyId");
  }

  const itemsForCycle: Array<{ subassemblyId?: number | null }> = data.items !== undefined
    ? flattenItems(data.items)
    : existing.items;

  await assertNoSubassemblyCycle(finalSubassemblyId, itemsForCycle);

  return prisma.$transaction(async (tx) => {
    await tx.bom.update({
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
    });
    if (data.items !== undefined) {
      await tx.bomItem.deleteMany({ where: { bomId: id, parentBomItemId: null } });
      if (data.items.length > 0) {
        await createBomItemTree(tx, id, data.items);
      }
    }
    const row = await tx.bom.findUniqueOrThrow({ where: { id }, include });
    return withItemTree(row as typeof row & BomWithItems);
  });
}

export async function deleteBom(id: number) {
  await prisma.bom.delete({ where: { id } });
}
