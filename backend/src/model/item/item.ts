import prisma from "../../lib/prisma.js";

export interface ItemFilter {
  q?: string;
  divisiId?: number;
  aktif?: boolean;
  jenis?: string;
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
      ...(filter.jenis ? { jenis: { contains: filter.jenis } } : {}),
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
  jenis?: string | null;
  isActive?: boolean;
}) {
  return prisma.item.create({ data, include: { divisi: divisiSelect } });
}

export async function updateItem(
  id: number,
  data: { kode?: string; nama?: string; divisiId?: number | null; unit?: string; jenis?: string | null; isActive?: boolean },
) {
  return prisma.item.update({ where: { id }, data, include: { divisi: divisiSelect } });
}

export async function deleteItem(id: number) {
  await prisma.item.delete({ where: { id } });
}

// Edit massal kolom bebas: `undefined` = tak diubah, `null` = kosongkan.
// Satu query updateMany, atomik. ID tak dikenal diabaikan — kembalian count dipakai controller.
export class DivisiTidakDikenalError extends Error {
  readonly code = "DIVISI_TIDAK_DIKENAL";
  constructor() {
    super("Divisi tidak ditemukan");
    this.name = "DivisiTidakDikenalError";
  }
}

export async function bulkUpdateItems(
  ids: number[],
  data: { jenis?: string | null; divisiId?: number | null },
): Promise<number> {
  const uniq = [...new Set(ids)];
  if (data.divisiId !== undefined && data.divisiId !== null) {
    const ada = await prisma.divisi.findUnique({ where: { id: data.divisiId }, select: { id: true } });
    if (!ada) throw new DivisiTidakDikenalError();
  }
  const { count } = await prisma.item.updateMany({
    where: { id: { in: uniq } },
    data: {
      ...(data.jenis !== undefined ? { jenis: data.jenis } : {}),
      ...(data.divisiId !== undefined ? { divisiId: data.divisiId } : {}),
    },
  });
  return count;
}
