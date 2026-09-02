import prisma from "../../lib/prisma.js";

export async function getAllSizes() {
  return prisma.size.findMany({
    orderBy: { urutan: "asc" },
  });
}

export async function getSizeById(id: number) {
  return prisma.size.findUnique({ where: { id } });
}

export async function createSize(data: { nama: string; urutan?: number }) {
  return prisma.size.create({ data });
}

export async function updateSize(id: number, data: { nama?: string; urutan?: number }) {
  return prisma.size.update({ where: { id }, data });
}

export async function deleteSize(id: number) {
  await prisma.size.delete({ where: { id } });
}
