import prisma from "../../lib/prisma.js";

export async function getAllKaryawan() {
  return prisma.karyawan.findMany({
    orderBy: { nama: "asc" },
  });
}

export async function getKaryawanById(id: number) {
  return prisma.karyawan.findUnique({ where: { id } });
}

export async function createKaryawan(data: { nama: string; jabatan: string }) {
  return prisma.karyawan.create({ data });
}

export async function updateKaryawan(id: number, data: { nama: string; jabatan: string }) {
  return prisma.karyawan.update({ where: { id }, data });
}

export async function deleteKaryawan(id: number) {
  await prisma.karyawan.delete({ where: { id } });
}
