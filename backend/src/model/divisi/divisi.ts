import prisma from "../../lib/prisma.js";

export async function getAllDivisi() {
  return prisma.divisi.findMany({
    orderBy: { nama: "asc" },
    include: { _count: { select: { karyawan: true } } },
  });
}

export async function getDivisiById(id: number) {
  return prisma.divisi.findUnique({
    where: { id },
    include: { karyawan: { orderBy: { nama: "asc" } } },
  });
}

export async function createDivisi(data: { nama: string }) {
  return prisma.divisi.create({ data });
}

export async function updateDivisi(id: number, data: { nama: string }) {
  return prisma.divisi.update({ where: { id }, data });
}

export async function deleteDivisi(id: number) {
  await prisma.divisi.delete({ where: { id } });
}
