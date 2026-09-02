import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

export type StatusBarang = "REGISTER" | "FINISHGOOD" | "RETUR" | "OUT" | "BAD";

export const VALID_STATUSES: StatusBarang[] = [
  "REGISTER",
  "FINISHGOOD",
  "RETUR",
  "OUT",
  "BAD",
];

export const VALID_TRANSITIONS: Record<StatusBarang, StatusBarang[]> = {
  REGISTER: ["FINISHGOOD", "OUT", "RETUR", "BAD"],
  FINISHGOOD: ["OUT", "RETUR", "BAD"],
  RETUR: ["FINISHGOOD", "OUT", "BAD"],
  OUT: [],
  BAD: [],
};

function validateTransition(
  current: StatusBarang,
  next: StatusBarang,
): boolean {
  if (current === next) return true;
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export async function updateBarangStatus(
  barangId: number,
  newStatus: StatusBarang,
  keterangan?: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.barang.findUnique>>>> {
  const barang = await prisma.barang.findUnique({ where: { id: barangId } });

  if (!barang) {
    throw new Error("Barang tidak ditemukan");
  }

  if (!validateTransition(barang.status as StatusBarang, newStatus)) {
    throw new Error(
      `Transisi status dari ${barang.status} ke ${newStatus} tidak valid`,
    );
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const updatedBarang = await tx.barang.update({
      where: { id: barangId },
      data: { status: newStatus },
      include: {
        variant: {
          include: {
            product: true,
            style: true,
            color: true,
            size: true,
          },
        },
        batch: {
          select: {
            id: true,
            nomorBatch: true,
            totalProduksi: true,
            kapasitas: true,
            status: true,
          },
        },
      },
    });

    await tx.riwayatBarang.create({
      data: {
        barangId,
        status: newStatus,
        keterangan,
      },
    });

    return updatedBarang;
  });
}

export async function bulkUpdateBarangStatus(
  items: { id: number; status: StatusBarang; keterangan?: string }[],
): Promise<{
  success: Awaited<ReturnType<typeof updateBarangStatus>>[];
  failed: { id: number; error: string }[];
}> {
  const success: Awaited<ReturnType<typeof updateBarangStatus>>[] = [];
  const failed: { id: number; error: string }[] = [];

  for (const item of items) {
    try {
      const updated = await updateBarangStatus(
        item.id,
        item.status,
        item.keterangan,
      );
      success.push(updated);
    } catch (error) {
      failed.push({
        id: item.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { success, failed };
}
