import prisma from "../../lib/prisma.js";

export async function getAllTransitions() {
  return prisma.statusTransition.findMany({
    orderBy: [{ fromKode: "asc" }, { toKode: "asc" }],
  });
}

// Ganti daftar tujuan untuk satu status sumber. toKodes kosong =
// hapus semua aturan dari status itu (= izinkan semua tujuan).
export async function setTransitionsForFrom(fromKode: string, toKodes: string[]) {
  const from = fromKode.trim().toUpperCase();
  const tos = [...new Set(toKodes.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  return prisma.$transaction(async (tx) => {
    await tx.statusTransition.deleteMany({ where: { fromKode: from } });
    if (tos.length > 0) {
      await tx.statusTransition.createMany({
        data: tos.map((toKode) => ({ fromKode: from, toKode })),
      });
    }
    return tx.statusTransition.findMany({
      where: { fromKode: from },
      orderBy: { toKode: "asc" },
    });
  });
}

export async function deleteTransition(fromKode: string, toKode: string) {
  return prisma.statusTransition.delete({
    where: { fromKode_toKode: { fromKode, toKode } },
  });
}
