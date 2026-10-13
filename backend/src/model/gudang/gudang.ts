import prisma from "../../lib/prisma.js";
import { statusScopeFilter } from "../barang/barang.status.js";

const countBarang = { _count: { select: { barang: true } } };

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

export async function getGudangById(id: number, statusScope?: string[] | null) {
  const row = await prisma.gudang.findUnique({ where: { id }, include: countBarang });
  if (!row) return null;
  const [recounted] = await recountByScope([row], statusScope);
  return recounted;
}

export async function createGudang(data: { kode: string; name: string; isActive?: boolean }) {
  return prisma.gudang.create({ data, include: countBarang });
}

export async function updateGudang(
  id: number,
  data: { kode?: string; name?: string; isActive?: boolean },
) {
  return prisma.gudang.update({ where: { id }, data, include: countBarang });
}

// Hapus gudang: FK SetNull menjaga barang + riwayat mutasi tetap ada.
export async function deleteGudang(id: number) {
  await prisma.gudang.delete({ where: { id } });
}
