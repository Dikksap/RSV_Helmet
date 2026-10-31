import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

export type StatusBarang = string;

export const VALID_STATUSES: StatusBarang[] = [
  "REGISTER",
  "FINISHGOOD",
  "RETUR",
  "OUT",
  "BAD",
];

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

export async function updateBarangStatus(
  barangId: number,
  newStatus: StatusBarang,
  keterangan?: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.barang.findUnique>>>> {
  const target = String(newStatus).trim().toUpperCase();
  const barang = await prisma.barang.findUnique({ where: { id: barangId } });

  if (!barang) {
    throw new Error("Barang tidak ditemukan");
  }

  if (!(await isTransitionAllowed(barang.status as StatusBarang, target))) {
    throw new Error(
      await transitionErrorMessage(barang.status, target),
    );
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const updatedBarang = await tx.barang.update({
      where: { id: barangId },
      data: { status: target },
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
        status: target,
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
