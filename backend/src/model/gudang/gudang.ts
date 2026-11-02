import prisma from "../../lib/prisma.js";
import { statusScopeFilter } from "../barang/barang.status.js";

export type GudangInput = {
  kode: string;
  name: string;
  isActive?: boolean;
};

const countBarang = {
  _count: { select: { barang: true } },
  jenisItems: { select: { jenis: true }, orderBy: { jenis: "asc" as const } },
};

const warehouseSelect = {
  id: true,
  kode: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { barang: true } },
  jenisItems: { select: { jenis: true }, orderBy: { jenis: "asc" as const } },
} as const;

/** Hitung ulang _count.barang sesuai scope visibilitas status pemanggil. */
async function recountByScope<T extends { id: number; _count: { barang: number } }>(
  groups: T[],
  statusScope: string[] | null | undefined,
) {
  if (statusScope === null || statusScope === undefined || groups.length === 0) return groups;
  const filter = statusScopeFilter(statusScope);
  const counts = await prisma.barang.groupBy({
    by: ["gudangId"],
    where: { gudangId: { in: groups.map((g) => g.id) }, ...(filter ? { status: filter } : {}) },
    _count: { _all: true },
  });
  const map = new Map(counts.map((c) => [c.gudangId, c._count._all]));
  return groups.map((g) => ({ ...g, _count: { ...g._count, barang: map.get(g.id) ?? 0 } }));
}

export async function listGudang(statusScope?: string[] | null) {
  const rows = await prisma.gudang.findMany({
    orderBy: [{ name: "asc" }, { kode: "asc" }],
    include: countBarang,
  });
  return recountByScope(rows, statusScope);
}

export async function createGudang(input: GudangInput) {
  return prisma.$transaction(async (tx) => {
    const gudang = await tx.gudang.create({
      data: {
        kode: input.kode,
        name: input.name,
        isActive: input.isActive ?? true,
      },
      select: { id: true, kode: true, name: true, isActive: true },
    });
    await tx.inventoryLocation.create({
      data: {
        code: `WH-${gudang.id}`,
        name: gudang.name,
        type: "WAREHOUSE",
        gudangId: gudang.id,
        isActive: gudang.isActive,
      },
    });
    return tx.gudang.findUniqueOrThrow({
      where: { id: gudang.id },
      select: warehouseSelect,
    });
  });
}

export async function updateGudang(id: number, input: Partial<GudangInput>) {
  return prisma.$transaction(async (tx) => {
    const gudang = await tx.gudang.update({
      where: { id },
      data: input,
      select: { id: true, kode: true, name: true, isActive: true },
    });
    const location = await tx.inventoryLocation.findUnique({
      where: { gudangId: id },
      select: { id: true },
    });
    if (location) {
      await tx.inventoryLocation.update({
        where: { id: location.id },
        data: { name: gudang.name, isActive: gudang.isActive },
      });
    } else {
      await tx.inventoryLocation.create({
        data: {
          code: `WH-${gudang.id}`,
          name: gudang.name,
          type: "WAREHOUSE",
          gudangId: gudang.id,
          isActive: gudang.isActive,
        },
      });
    }
    return tx.gudang.findUniqueOrThrow({
      where: { id },
      select: warehouseSelect,
    });
  });
}

export async function deactivateGudang(id: number) {
  return updateGudang(id, { isActive: false });
}

export async function setGudangJenis(gudangId: number, jenis: string[]) {
  return prisma.$transaction(async (tx) => {
    const gudang = await tx.gudang.findUnique({
      where: { id: gudangId },
      select: { id: true },
    });
    if (!gudang) return null;
    await tx.gudangJenisItem.deleteMany({ where: { gudangId } });
    if (jenis.length > 0) {
      await tx.gudangJenisItem.createMany({
        data: jenis.map((value) => ({ gudangId, jenis: value })),
      });
    }
    return tx.gudang.findUnique({
      where: { id: gudangId },
      select: { id: true, kode: true, name: true, jenisItems: { select: { jenis: true } } },
    });
  });
}
