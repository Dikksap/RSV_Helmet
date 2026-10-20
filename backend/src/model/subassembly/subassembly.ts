import prisma from "../../lib/prisma.js";

export interface SubassemblyFilter {
  q?: string;
  aktif?: boolean;
  productVariantId?: number;
}

const include = {
  item: { select: { id: true, kode: true, nama: true, unit: true, jenis: true, isActive: true } },
  productVariant: {
    select: { id: true, kodeVariant: true, productId: true, product: { select: { id: true, nama: true, prefix: true } } },
  },
  _count: { select: { bomAsOutput: true, usedInBomItems: true } },
} as const;

export async function ensureSubassembliesFromSMItems() {
  const items = await prisma.item.findMany({
    where: { isActive: true, OR: [{ jenis: "SM" }, { kode: { startsWith: "SM" } }] },
    select: { id: true, kode: true, nama: true, isActive: true },
  });
  for (const item of items) {
    const existingByItem = await prisma.subassembly.findUnique({ where: { itemId: item.id }, select: { id: true } });
    if (existingByItem) {
      await prisma.subassembly.update({
        where: { id: existingByItem.id },
        data: { kode: item.kode, nama: item.nama, isActive: item.isActive },
      });
      continue;
    }
    const existingByKode = await prisma.subassembly.findUnique({ where: { kode: item.kode }, select: { id: true } });
    if (existingByKode) {
      await prisma.subassembly.update({
        where: { id: existingByKode.id },
        data: { itemId: item.id, nama: item.nama, isActive: item.isActive },
      });
      continue;
    }
    try {
      await prisma.subassembly.create({
        data: { kode: item.kode, nama: item.nama, itemId: item.id, isActive: item.isActive },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
  return items.length;
}

export async function listSubassemblies(filter: SubassemblyFilter) {
  await ensureSubassembliesFromSMItems();
  return prisma.subassembly.findMany({
    where: {
      ...(filter.q ? { OR: [{ kode: { contains: filter.q } }, { nama: { contains: filter.q } }] } : {}),
      ...(filter.aktif !== undefined ? { isActive: filter.aktif } : {}),
      ...(filter.productVariantId !== undefined ? { productVariantId: filter.productVariantId } : {}),
    },
    include,
    orderBy: [{ kode: "asc" }, { id: "asc" }],
  });
}

export async function getSubassemblyById(id: number) {
  return prisma.subassembly.findUnique({ where: { id }, include });
}

export async function createSubassembly(data: {
  kode: string;
  nama: string;
  itemId?: number | null;
  productVariantId?: number | null;
  isActive?: boolean;
}) {
  return prisma.subassembly.create({ data, include });
}

export async function updateSubassembly(
  id: number,
  data: { kode?: string; nama?: string; itemId?: number | null; productVariantId?: number | null; isActive?: boolean },
) {
  return prisma.subassembly.update({ where: { id }, data, include });
}

export async function deleteSubassembly(id: number) {
  await prisma.subassembly.delete({ where: { id } });
}
