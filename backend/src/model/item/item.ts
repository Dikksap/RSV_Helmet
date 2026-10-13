import prisma from "../../lib/prisma.js";

export interface ItemFilter {
  q?: string;
  divisiId?: number;
  aktif?: boolean;
}

const divisiSelect = { select: { id: true, nama: true } };

export async function listItems(filter: ItemFilter = {}) {
  return prisma.item.findMany({
    where: {
      ...(filter.q
        ? { OR: [{ kode: { contains: filter.q } }, { nama: { contains: filter.q } }] }
        : {}),
      ...(filter.divisiId !== undefined ? { divisiId: filter.divisiId } : {}),
      ...(filter.aktif !== undefined ? { isActive: filter.aktif } : {}),
    },
    include: { divisi: divisiSelect },
    orderBy: [{ nama: "asc" }, { kode: "asc" }],
  });
}

export async function getItemById(id: number) {
  return prisma.item.findUnique({
    where: { id },
    include: { divisi: divisiSelect },
  });
}

export async function createItem(data: {
  kode: string;
  nama: string;
  divisiId?: number | null;
  unit?: string;
  isActive?: boolean;
}) {
  return prisma.item.create({ data, include: { divisi: divisiSelect } });
}

export async function updateItem(
  id: number,
  data: { kode?: string; nama?: string; divisiId?: number | null; unit?: string; isActive?: boolean },
) {
  return prisma.item.update({ where: { id }, data, include: { divisi: divisiSelect } });
}

export async function deleteItem(id: number) {
  await prisma.item.delete({ where: { id } });
}
