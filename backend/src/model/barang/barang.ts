import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { generateBarangBulk, getGenerateInfo } from "./barang.generate.js";
import {
  VALID_STATUSES,
  VALID_TRANSITIONS,
  bulkUpdateBarangStatus,
  updateBarangStatus,
  type StatusBarang,
} from "./barang.status.js";
import {
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  getStatusSummary,
} from "./barang.stats.js";

export {
  generateBarangBulk,
  getGenerateInfo,
  VALID_STATUSES,
  VALID_TRANSITIONS,
  bulkUpdateBarangStatus,
  updateBarangStatus,
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  getStatusSummary,
};
export type { StatusBarang };
export type {
  FinishgoodPerBulanRow,
  FinishgoodPerBulanFilter,
  BatchRentangRow,
  BatchRentangFilter,
} from "./barang.stats.js";

export const barangInclude = {
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
};

export interface BarangListFilter {
  page: number;
  limit: number;
  variantId?: number;
  batchId?: number;
  status?: StatusBarang;
  tanggalAwal?: Date;
  tanggalAkhir?: Date;
}

export async function listBarang(filter: BarangListFilter) {
  const { page, limit, variantId, batchId, status, tanggalAwal, tanggalAkhir } =
    filter;

  const where: {
    variantId?: number;
    batchId?: number;
    status?: StatusBarang;
    tanggal?: { gte?: Date; lte?: Date };
  } = {};

  if (variantId !== undefined) where.variantId = variantId;
  if (batchId !== undefined) where.batchId = batchId;
  if (status) where.status = status;
  if (tanggalAwal || tanggalAkhir) {
    where.tanggal = {};
    if (tanggalAwal) where.tanggal.gte = tanggalAwal;
    if (tanggalAkhir) where.tanggal.lte = tanggalAkhir;
  }

  const [total, data] = await prisma.$transaction([
    prisma.barang.count({ where }),
    prisma.barang.findMany({
      where,
      include: barangInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getBarangById(id: number) {
  return prisma.barang.findUnique({
    where: { id },
    include: barangInclude,
  });
}

export async function searchBarangByKode(opts: {
  q: string;
  limit: number;
}): Promise<{
  data: Awaited<ReturnType<typeof prisma.barang.findMany>>;
  meta: { q: string; count: number };
}> {
  const kode = opts.q.trim();
  const data = await prisma.barang.findMany({
    where: { kodeBarang: { contains: kode } },
    include: barangInclude,
    orderBy: { kodeBarang: "asc" },
    take: opts.limit,
  });

  return { data, meta: { q: kode, count: data.length } };
}

export async function findBarangByKodeList(
  kodeList: string[],
): Promise<{ id: number; kodeBarang: string; status: StatusBarang }[]> {
  if (kodeList.length === 0) return [];

  return prisma.barang.findMany({
    where: { kodeBarang: { in: kodeList } },
    select: { id: true, kodeBarang: true, status: true },
  });
}

export async function getRiwayatByBarangId(id: number) {
  const barang = await prisma.barang.findUnique({
    where: { id },
    select: { id: true, kodeBarang: true, status: true },
  });

  if (!barang) return null;

  const riwayat = await prisma.riwayatBarang.findMany({
    where: { barangId: id },
    orderBy: { tanggal: "desc" },
  });

  return {
    data: riwayat,
    summary: {
      kodeBarang: barang.kodeBarang,
      currentStatus: barang.status,
      total: riwayat.length,
    },
  };
}

export async function scanBarang(
  kodeBarang: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.barang.findUnique>>>> {
  const barang = await prisma.barang.findUnique({
    where: { kodeBarang },
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

  if (!barang) {
    throw new Error("Barang tidak ditemukan");
  }

  return barang;
}

export async function bulkScanBarang(
  kodeBarangList: string[],
  newStatus: StatusBarang,
  keterangan?: string,
): Promise<{
  success: Array<NonNullable<Awaited<ReturnType<typeof prisma.barang.update>>>>;
  failed: { kodeBarang: string; error: string }[];
}> {
  const uniqueKodeBarang = [...new Set(kodeBarangList)];
  const duplicates = kodeBarangList.filter(
    (kode, index) => kodeBarangList.indexOf(kode) !== index,
  );

  const results: Array<
    NonNullable<Awaited<ReturnType<typeof prisma.barang.update>>>
  > = [];
  const failed: { kodeBarang: string; error: string }[] = [];

  for (const kode of uniqueKodeBarang) {
    try {
      const barang = await prisma.barang.findUnique({
        where: { kodeBarang: kode },
      });

      if (!barang) {
        failed.push({ kodeBarang: kode, error: "Barang tidak ditemukan" });
        continue;
      }

      if (
        !VALID_TRANSITIONS[barang.status as StatusBarang]?.includes(newStatus)
      ) {
        failed.push({
          kodeBarang: kode,
          error: `Transisi status dari ${barang.status} ke ${newStatus} tidak valid`,
        });
        continue;
      }

      const updated = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const updatedBarang = await tx.barang.update({
          where: { id: barang.id },
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
            barangId: barang.id,
            status: newStatus,
            keterangan,
          },
        });

        return updatedBarang;
      });

      results.push(updated);
    } catch (error) {
      failed.push({
        kodeBarang: kode,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  for (const duplicate of duplicates) {
    failed.push({
      kodeBarang: duplicate,
      error: "Duplicate barcode dalam request",
    });
  }

  return { success: results, failed };
}
