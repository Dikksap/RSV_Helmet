import prisma from "../../lib/prisma.js";

export async function getAllBatch() {
  return prisma.productionBatch.findMany({
    orderBy: { nomorBatch: "asc" },
    include: { _count: { select: { barang: true } } },
  });
}

export async function getBatchById(id: number) {
  return prisma.productionBatch.findUnique({
    where: { id },
    include: { _count: { select: { barang: true } } },
  });
}

export async function createBatch(data: { kapasitas?: number }) {
  const last = await prisma.productionBatch.findFirst({
    orderBy: { nomorBatch: "desc" },
    select: { nomorBatch: true },
  });
  return prisma.productionBatch.create({
    data: {
      nomorBatch: (last?.nomorBatch ?? 0) + 1,
      kapasitas: data.kapasitas ?? 5000,
    },
  });
}

export async function updateBatch(
  id: number,
  data: { kapasitas?: number; status?: "AKTIF" | "SELESAI" },
) {
  return prisma.productionBatch.update({ where: { id }, data });
}

export async function deleteBatch(id: number) {
  const row = await prisma.productionBatch.findUnique({
    where: { id },
    include: { _count: { select: { barang: true } } },
  });
  if (!row) {
    throw Object.assign(new Error("Batch tidak ditemukan"), { code: "P2025" });
  }
  if (row._count.barang > 0) {
    throw Object.assign(new Error("Batch masih berisi barang dan tidak boleh dihapus"), { code: "E409" });
  }
  await prisma.productionBatch.delete({ where: { id } });
}
