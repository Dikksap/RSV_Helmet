import prisma from "../../lib/prisma.js";
import { clearBarangCache } from "../../lib/barangCache.js";
import { getReturInfo } from "../barang/barang.js";

const countBarang = { _count: { select: { barang: true } } };

export const DUS_CAPACITY = 8;

async function attachPernahRetur<T extends { id: number }>(items: T[]) {
  if (items.length === 0) return items as (T & { pernahRetur: boolean })[];
  const info = await getReturInfo(items.map((b) => b.id));
  return items.map((b) => ({ ...b, pernahRetur: info.get(b.id)?.pernahRetur ?? false }));
}

export async function getAllBarangGroup() {
  const groups = await prisma.barangGroup.findMany({
    include: {
      ...countBarang,
      barang: {
        include: { variant: { include: { product: true, style: true, color: true, size: true } } },
        orderBy: { kodeBarang: "asc" },
      },
    },
    orderBy: { nama: "asc" },
  });
  const allIds = groups.flatMap((g) => g.barang.map((b) => b.id));
  const info = await getReturInfo(allIds);
  return groups.map((g) => ({
    ...g,
    barang: g.barang.map((b) => ({ ...b, pernahRetur: info.get(b.id)?.pernahRetur ?? false })),
  }));
}

export async function getBarangGroupById(id: number) {
  return prisma.barangGroup.findUnique({
    where: { id },
    include: countBarang,
  });
}

export async function createBarangGroup(data: { nama: string }) {
  return prisma.barangGroup.create({ data, include: countBarang });
}

export async function updateBarangGroup(id: number, data: { nama?: string; isArsip?: boolean }) {
  return prisma.barangGroup.update({ where: { id }, data, include: countBarang });
}

export async function deleteBarangGroup(id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.barang.updateMany({ where: { groupId: id }, data: { groupId: null } });
    await tx.barangGroup.delete({ where: { id } });
  });
}

export async function assignBarangToGroup(groupId: number, barangIds: number[]) {
  if (barangIds.length === 0) return { updated: 0, skipped: 0 };
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM BarangGroup WHERE id = ${groupId} FOR UPDATE`;
    const updated = await tx.barang.updateMany({
      where: { id: { in: barangIds }, OR: [{ groupId: null }, { groupId: { not: groupId } }] },
      data: { groupId },
    });
    const rows = await tx.$queryRaw<[{ barang: number }]>`
      SELECT COUNT(*) AS barang FROM Barang WHERE groupId = ${groupId}`;
    if (Number(rows[0].barang) > DUS_CAPACITY) {
      const error = new Error(`Dus hanya muat ${DUS_CAPACITY} barang`) as Error & { code?: string };
      error.code = "GROUP_FULL";
      throw error;
    }
    if (updated.count > 0) await clearBarangCache();
    return { updated: updated.count, skipped: barangIds.length - updated.count };
  });
}

export async function getBarangInGroup(groupId: number) {
  const items = await prisma.barang.findMany({
    where: { groupId },
    include: {
      variant: { include: { product: true, style: true, color: true, size: true } },
    },
    orderBy: { kodeBarang: "asc" },
  });
  return attachPernahRetur(items);
}

export async function unassignBarangFromGroup(groupId: number, barangIds: number[]) {
  const updated = await prisma.barang.updateMany({
    where: { id: { in: barangIds }, groupId },
    data: { groupId: null },
  });
  if (updated.count > 0) await clearBarangCache();
  return { updated: updated.count, skipped: barangIds.length - updated.count };
}
