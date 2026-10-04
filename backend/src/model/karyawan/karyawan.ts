import prisma from "../../lib/prisma.js";

export async function getAllKaryawan() {
  return prisma.karyawan.findMany({
    orderBy: { nama: "asc" },
    include: { divisi: { select: { id: true, nama: true } } },
  });
}

export async function getKaryawanById(id: number) {
  return prisma.karyawan.findUnique({
    where: { id },
    include: { divisi: { select: { id: true, nama: true } } },
  });
}

export async function createKaryawan(data: { nama: string; jabatan: string; divisiId?: number | null }) {
  return prisma.karyawan.create({ data });
}

export async function updateKaryawan(id: number, data: { nama: string; jabatan: string; divisiId?: number | null }) {
  return prisma.karyawan.update({ where: { id }, data });
}

export async function deleteKaryawan(id: number) {
  await prisma.karyawan.delete({ where: { id } });
}
