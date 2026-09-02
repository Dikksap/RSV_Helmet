import prisma from "../../lib/prisma.js";

export async function getAllColors() {
  return prisma.color.findMany({
    orderBy: { nama: "asc" },
  });
}

export async function getColorById(id: number) {
  return prisma.color.findUnique({ where: { id } });
}

export async function createColor(data: { nama: string }) {
  return prisma.color.create({ data });
}

export async function updateColor(id: number, data: { nama: string }) {
  return prisma.color.update({ where: { id }, data });
}

export async function deleteColor(id: number) {
  await prisma.color.delete({ where: { id } });
}
