import prisma from "../../lib/prisma.js";
import { clearBarangCache } from "../../lib/barangCache.js";

const countBarang = { _count: { select: { barang: true } } };

export async function getAllBarangGroup() {
  return prisma.barangGroup.findMany({
    include: countBarang,
    orderBy: { nama: "asc" },
  });
}

export async function getBarangGroupById(id: number) {
  return prisma.barangGroup.findUnique({
    where: { id },
    include: countBarang,
  });
}

export async function createBarangGroup(data: { nama: string }) {
  return prisma.barangGroup.create({ data });
}

export async function updateBarangGroup(id: number, data: { nama: string }) {
  return prisma.barangGroup.update({ where: { id }, data });
}

export async function deleteBarangGroup(id: number) {
  await prisma.barangGroup.delete({ where: { id } });
}

export async function assignBarangToGroup(groupId: number, barangIds: number[]) {
  const updated = await prisma.barang.updateMany({
    where: { id: { in: barangIds } },
    data: { groupId },
  });
  if (updated.count > 0) await clearBarangCache();
  return { updated: updated.count, skipped: barangIds.length - updated.count };
}

export async function unassignBarangFromGroup(groupId: number, barangIds: number[]) {
  const updated = await prisma.barang.updateMany({
    where: { id: { in: barangIds }, groupId },
    data: { groupId: null },
  });
  if (updated.count > 0) await clearBarangCache();
  return { updated: updated.count, skipped: barangIds.length - updated.count };
}
