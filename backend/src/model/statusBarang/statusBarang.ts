import prisma from "../../lib/prisma.js";

export async function getAllStatusBarang(includeInactive = false) {
  return prisma.statusBarang.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ urutan: "asc" }, { kode: "asc" }],
  });
}

export async function getStatusBarangById(id: number) {
  return prisma.statusBarang.findUnique({ where: { id } });
}

export async function getStatusBarangByKode(kode: string) {
  return prisma.statusBarang.findUnique({ where: { kode } });
}

export async function createStatusBarang(data: {
  kode: string;
  nama: string;
  warna?: string | null;
  urutan?: number;
  isActive?: boolean;
}) {
  return prisma.statusBarang.create({ data });
}

export async function updateStatusBarang(
  id: number,
  data: { kode?: string; nama?: string; warna?: string | null; urutan?: number; isActive?: boolean },
) {
  return prisma.statusBarang.update({ where: { id }, data });
}

export async function deleteStatusBarang(id: number) {
  await prisma.statusBarang.delete({ where: { id } });
}
