import prisma from "../../lib/prisma.js";

export async function getAllStyles() {
  return prisma.style.findMany({
    orderBy: { nama: "asc" },
  });
}

export async function getStyleById(id: number) {
  return prisma.style.findUnique({ where: { id } });
}

export async function createStyle(data: { nama: string }) {
  return prisma.style.create({ data });
}

export async function updateStyle(id: number, data: { nama: string }) {
  return prisma.style.update({ where: { id }, data });
}

export async function deleteStyle(id: number) {
  await prisma.style.delete({ where: { id } });
}
