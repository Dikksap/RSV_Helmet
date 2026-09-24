import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { clearBarangCache } from "../../lib/barangCache.js";

// StatusBarang sekarang dinamis (tabel StatusBarang), tipe = string
export type StatusBarang = string;

// Hardcode transisi untuk 5 status awal. Status dinamis baru dianggap
// terbuka (allow any) agar langsung bisa dipakai tanpa config transisi.
export const VALID_TRANSITIONS: Record<string, string[]> = {
  REGISTER: ["FINISHGOOD", "OUT", "RETUR", "BAD"],
  FINISHGOOD: ["OUT", "RETUR", "BAD"],
  RETUR: ["FINISHGOOD", "OUT", "BAD"],
  OUT: ["RETUR"],
  BAD: ["FINISHGOOD"],
};

export async function getValidStatusKodes(): Promise<string[]> {
  const rows = await prisma.statusBarang.findMany({
    where: { isActive: true },
    select: { kode: true },
    orderBy: { urutan: "asc" },
  });
  return rows.map((r) => r.kode);
}

function validateTransition(current: string, next: string): boolean {
  if (current === next) return true;
  const isCurrentHardcoded = current in VALID_TRANSITIONS;
  const isNextHardcoded = next in VALID_TRANSITIONS;
  if (isCurrentHardcoded && isNextHardcoded) {
    return VALID_TRANSITIONS[current]?.includes(next) ?? false;
  }
  // Salah satu dinamis -> izinkan transisi (status valid sudah dicek)
  return true;
}

export async function updateBarangStatus(
  barangId: number,
  newStatus: string,
  keterangan?: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.barang.findUnique>>>> {
  const barang = await prisma.barang.findUnique({ where: { id: barangId } });

  if (!barang) {
    throw new Error("Barang tidak ditemukan");
  }

  // Validasi status ada & aktif
  const statusRow = await prisma.statusBarang.findUnique({ where: { kode: newStatus } });
  if (!statusRow || !statusRow.isActive) {
    throw new Error(`Status '${newStatus}' tidak valid atau tidak aktif`);
  }

  if (!validateTransition(barang.status, newStatus)) {
    throw new Error(`Transisi status dari ${barang.status} ke ${newStatus} tidak valid`);
  }

  const updated = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
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

  await clearBarangCache();
  return updated;
}

export async function bulkUpdateBarangStatus(
  items: { id: number; status: string; keterangan?: string }[],
): Promise<{
  success: Awaited<ReturnType<typeof updateBarangStatus>>[];
  failed: { id: number; error: string }[];
}> {
  const success: Awaited<ReturnType<typeof updateBarangStatus>>[] = [];
  const failed: { id: number; error: string }[] = [];

  for (const item of items) {
    try {
      const updated = await updateBarangStatus(item.id, item.status, item.keterangan);
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
