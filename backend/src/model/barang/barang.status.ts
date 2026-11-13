import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";

export type StatusBarang = string;

export const VALID_STATUSES: StatusBarang[] = [
  "REGISTER",
  "FINISHGOOD",
  "RETUR",
  "OUT",
  "BAD",
];

const FINISH_GOOD = "FINISHGOOD";

export type StatusFilter = StatusBarang | { in: StatusBarang[] } | undefined;

export function statusScopeFilter(
  scope: string[] | null | undefined,
  status?: string,
): StatusFilter {
  if (scope === null || scope === undefined) return status;
  if (status) return scope.includes(status) ? status : { in: [] };
  return { in: scope };
}

// null = belum ada aturan untuk status sumber, artinya semua tujuan diizinkan.
export async function getAllowedTransitions(
  current: string,
): Promise<string[] | null> {
  const rows = await prisma.statusTransition.findMany({
    where: { fromKode: current },
    select: { toKode: true },
    orderBy: { toKode: "asc" },
  });
  return rows.length === 0 ? null : rows.map((row) => row.toKode);
}

export async function isTransitionAllowed(
  current: string,
  next: string,
): Promise<boolean> {
  if (current === next) return true;
  const allowed = await getAllowedTransitions(current);
  return allowed === null || allowed.includes(next);
}

export async function transitionErrorMessage(
  current: string,
  next: string,
): Promise<string> {
  const allowed = await getAllowedTransitions(current);
  return `Transisi status dari ${current} ke ${next} tidak valid (diizinkan: ${allowed === null ? "semua" : allowed.join(", ")})`;
}

export type BarangWithRelations = Prisma.BarangGetPayload<{ include: typeof barangInclude }>;

const barangInclude = {
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
} as const;

/**
 * Ubah status barang.
 *
 * FINISHGOOD BUKAN sekadar status generik: scan/patch FINISHGOOD adalah
 * konfirmasi operasional bahwa unit sudah lolos QC. Karena itu:
 * - `finishGoodAt` diisi sekali (write-once) dan tidak pernah dihapus/geser.
 * - Scan ulang FINISHGOOD tidak membuat histori FINISHGOOD baru.
 * - Tidak ada konsumsi material/inventory di sini.
 *
 * TIDAK ada ketergantungan pada QualityInspectionLine / QC PASS.
 */
export async function updateBarangStatus(
  barangId: number,
  newStatus: StatusBarang,
  keterangan?: string,
  options: { userId?: number | null } = {},
): Promise<BarangWithRelations & { alreadyFinishGood?: boolean }> {
  const target = String(newStatus).trim().toUpperCase();

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // Lock baris: dua operator/scan bersamaan tidak boleh menulis transisi
    // dan RiwayatBarang ganda.
    await tx.$queryRaw`SELECT id FROM Barang WHERE id = ${barangId} FOR UPDATE`;
    const barang = await tx.barang.findUnique({
      where: { id: barangId },
      select: { id: true, kodeBarang: true, status: true, finishGoodAt: true },
    });
    if (!barang) {
      throw new Error("Barang tidak ditemukan");
    }

    const statusMaster = await tx.statusBarang.findUnique({
      where: { kode: target },
      select: { kode: true, isActive: true },
    });
    if (!statusMaster || !statusMaster.isActive) {
      throw new Error(`Status '${target}' tidak valid`);
    }

    if (!(await isTransitionAllowed(barang.status as StatusBarang, target))) {
      throw new Error(await transitionErrorMessage(barang.status, target));
    }

    // Idempoten: unit yang sudah FINISHGOOD tidak menulis apa pun lagi.
    if (target === FINISH_GOOD && barang.status === FINISH_GOOD && barang.finishGoodAt !== null) {
      const existing = await tx.barang.findUniqueOrThrow({
        where: { id: barangId },
        include: barangInclude,
      });
      return { ...existing, alreadyFinishGood: true };
    }

    const isFirstFinishGood = target === FINISH_GOOD && barang.finishGoodAt === null;
    const finishGoodAt = isFirstFinishGood ? new Date() : undefined;

    if (isFirstFinishGood) {
      // Simpan waktu konfirmasi QC tanpa menghapus/merusak timestamp lama.
      await tx.$executeRaw`UPDATE Barang SET finishGoodAt = ${finishGoodAt} WHERE id = ${barangId} AND finishGoodAt IS NULL`;
    }

    const updatedBarang = await tx.barang.update({
      where: { id: barangId },
      data: {
        status: target,
        ...(finishGoodAt ? { finishGoodAt } : {}),
      },
      include: barangInclude,
    });

    // Scan ulang FINISHGOOD (status sudah FINISHGOOD tapi timestamp belum ada,
    // mis. data legacy) tetap tidak boleh menggandakan baris histori pertama.
    const alreadyRecorded =
      target === FINISH_GOOD &&
      (await tx.riwayatBarang.findFirst({
        where: { barangId, status: FINISH_GOOD },
        select: { id: true },
      })) !== null;

    if (!alreadyRecorded) {
      await tx.riwayatBarang.create({
        data: {
          barangId,
          status: target,
          ...(keterangan ? { keterangan } : {}),
          ...(target === FINISH_GOOD
            ? { keterangan: keterangan ?? "FINISHGOOD — konfirmasi lolos QC" }
            : {}),
        },
      });
    }

    return { ...updatedBarang, ...(target === FINISH_GOOD && alreadyRecorded ? { alreadyFinishGood: true } : {}) };
  });
}

export async function bulkUpdateBarangStatus(
  items: { id: number; status: StatusBarang; keterangan?: string }[],
  options: { userId?: number | null } = {},
): Promise<{
  success: Array<BarangWithRelations & { alreadyFinishGood?: boolean }>;
  failed: { id: number; error: string }[];
}> {
  const success: Array<BarangWithRelations & { alreadyFinishGood?: boolean }> = [];
  const failed: { id: number; error: string }[] = [];

  for (const item of items) {
    try {
      const updated = await updateBarangStatus(item.id, item.status, item.keterangan, options);
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
