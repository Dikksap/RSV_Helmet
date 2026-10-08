import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import {
  BARANG_TTL_LIST,
  barangListKey,
  barangSearchKey,
  clearBarangCache,
  getBarangCache,
  setBarangCache,
} from "../../lib/barangCache.js";
import { generateBarangBulk, getGenerateInfo } from "./barang.generate.js";
import {
  bulkUpdateBarangStatus,
  isTransitionAllowed,
  updateBarangStatus,
  type StatusBarang,
} from "./barang.status.js";
import {
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  getStatusSummary,
} from "./barang.stats.js";
import {
  createBarang,
  updateBarang,
  deleteBarang,
  type CreateBarangInput,
  type UpdateBarangInput,
} from "./barang.crud.js";

export {
  generateBarangBulk,
  getGenerateInfo,
  isTransitionAllowed,
  bulkUpdateBarangStatus,
  updateBarangStatus,
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  getStatusSummary,
  createBarang,
  updateBarang,
  deleteBarang,
  clearBarangCache,
};
export type { StatusBarang };
export type { CreateBarangInput, UpdateBarangInput } from "./barang.crud.js";
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
  group: {
    select: {
      id: true,
      nama: true,
    },
  },
};

export interface BarangListFilter {
  page: number;
  limit: number;
  variantId?: number;
  batchId?: number;
  groupId?: number;
  tanpaDus?: boolean;
  status?: StatusBarang;
  tanggalAwal?: Date;
  tanggalAkhir?: Date;
  pernahRetur?: boolean;
  styleId?: number;
  colorId?: number;
  sizeId?: number;
}

export interface ReturInfo {
  pernahRetur: boolean;
  jumlahRetur: number;
  tanggalReturTerakhir: string | null;
}

export async function getReturInfo(
  barangIds: number[],
): Promise<Map<number, ReturInfo>> {
  const info = new Map<number, ReturInfo>();
  if (barangIds.length === 0) return info;
  const rows = await prisma.riwayatBarang.groupBy({
    by: ["barangId"],
    where: { barangId: { in: barangIds }, status: "RETUR" },
    _count: { _all: true },
    _max: { tanggal: true },
  });
  for (const row of rows) {
    info.set(row.barangId, {
      pernahRetur: true,
      jumlahRetur: row._count._all,
      tanggalReturTerakhir: row._max.tanggal
        ? row._max.tanggal.toISOString()
        : null,
    });
  }
  return info;
}

function withReturInfo<T extends { id: number }>(
  items: T[],
  info: Map<number, ReturInfo>,
): (T & ReturInfo)[] {
  return items.map((item) => ({
    ...item,
    pernahRetur: info.get(item.id)?.pernahRetur ?? false,
    jumlahRetur: info.get(item.id)?.jumlahRetur ?? 0,
    tanggalReturTerakhir: info.get(item.id)?.tanggalReturTerakhir ?? null,
  }));
}

function normalizeStart(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

function normalizeEnd(d: Date): Date {
  const c = new Date(d);
  // Jika sudah di 23:59:59.999 biarkan, jika masih midnight paksa ke end-of-day
  // Ini buat defensive: controller sudah kirim end-of-day, tapi direct call juga aman
  if (
    c.getUTCHours() === 0 &&
    c.getUTCMinutes() === 0 &&
    c.getUTCSeconds() === 0 &&
    c.getUTCMilliseconds() === 0
  ) {
    c.setUTCHours(23, 59, 59, 999);
  }
  return c;
}

export async function listBarang(filter: BarangListFilter) {
  const { page, limit, variantId, batchId, groupId, tanpaDus, status, tanggalAwal, tanggalAkhir, pernahRetur, styleId, colorId, sizeId } =
    filter;

  const cacheKey = barangListKey({
    page,
    limit,
    variantId: variantId ?? "",
    batchId: batchId ?? "",
    groupId: groupId ?? "",
    tanpaDus: tanpaDus ?? "",
    status: status ?? "",
    tanggalAwal: tanggalAwal ?? "",
    tanggalAkhir: tanggalAkhir ?? "",
    pernahRetur: pernahRetur ?? "",
    styleId: styleId ?? "",
    colorId: colorId ?? "",
    sizeId: sizeId ?? "",
  });
  const cached = await getBarangCache<{ data: unknown[]; meta: unknown }>(cacheKey);
  if (cached) return cached as Awaited<ReturnType<typeof listBarangUncached>>;

  const result = await listBarangUncached(filter);
  await setBarangCache(cacheKey, result, BARANG_TTL_LIST);
  return result;
}

async function listBarangUncached(filter: BarangListFilter) {
  const { page, limit, variantId, batchId, groupId, tanpaDus, status, tanggalAwal, tanggalAkhir, pernahRetur, styleId, colorId, sizeId } =
    filter;

  const where: {
    variantId?: number;
    batchId?: number;
    groupId?: number | null;
    status?: StatusBarang;
    tanggal?: { gte?: Date; lte?: Date };
    riwayat?: { some: { status: string } };
    variant?: { styleId?: number; colorId?: number; sizeId?: number };
  } = {};

  if (variantId !== undefined) where.variantId = variantId;
  if (batchId !== undefined) where.batchId = batchId;
  if (groupId !== undefined) where.groupId = groupId;
  else if (tanpaDus) where.groupId = null;
  if (status) where.status = status;
  if (pernahRetur) where.riwayat = { some: { status: "RETUR" } };
  if (styleId !== undefined || colorId !== undefined || sizeId !== undefined) {
    where.variant = {
      ...(styleId !== undefined ? { styleId } : {}),
      ...(colorId !== undefined ? { colorId } : {}),
      ...(sizeId !== undefined ? { sizeId } : {}),
    };
  }
  if (tanggalAwal || tanggalAkhir) {
    where.tanggal = {};
    if (tanggalAwal) where.tanggal.gte = normalizeStart(tanggalAwal);
    if (tanggalAkhir) where.tanggal.lte = normalizeEnd(tanggalAkhir);
  }

  const [total, data] = await prisma.$transaction([
    prisma.barang.count({ where }),
    prisma.barang.findMany({
      where,
      include: barangInclude,
      orderBy: { updatedAt: "desc" },
      ...(limit > 0 ? { skip: (page - 1) * limit, take: limit } : {}),
    }),
  ]);

  const info = await getReturInfo(data.map((b) => b.id));

  return {
    data: withReturInfo(data, info),
    meta: {
      page: limit > 0 ? page : 1,
      limit: limit > 0 ? limit : total,
      total,
      totalPages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
    },
  };
}

export async function getBarangById(id: number) {
  const barang = await prisma.barang.findUnique({
    where: { id },
    include: barangInclude,
  });
  if (!barang) return null;
  const info = await getReturInfo([barang.id]);
  const enriched = withReturInfo([barang], info);
  return enriched[0];
}

export async function searchBarangByKode(opts: {
  q: string;
  limit: number;
  pernahRetur?: boolean;
}): Promise<{
  data: Awaited<ReturnType<typeof prisma.barang.findMany>>;
  meta: { q: string; count: number };
}> {
  const kode = opts.q.trim();
  const cacheKey = barangSearchKey(kode, opts.limit, opts.pernahRetur);
  const cached = await getBarangCache<{
    data: Awaited<ReturnType<typeof prisma.barang.findMany>>;
    meta: { q: string; count: number };
  }>(cacheKey);
  if (cached) return cached;
  const data = await prisma.barang.findMany({
    where: {
      kodeBarang: { contains: kode },
      ...(opts.pernahRetur
        ? { riwayat: { some: { status: "RETUR" } } }
        : {}),
    },
    include: barangInclude,
    orderBy: { kodeBarang: "asc" },
    take: opts.limit,
  });

  const info = await getReturInfo(data.map((b) => b.id));
  const result = {
    data: withReturInfo(data, info),
    meta: { q: kode, count: data.length },
  };
  await setBarangCache(cacheKey, result, BARANG_TTL_LIST);
  return result;
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

  const info = await getReturInfo([barang.id]);
  return withReturInfo([barang], info)[0];
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

      const allowed = await isTransitionAllowed(barang.status, newStatus);
      if (!allowed) {
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

  if (results.length > 0) await clearBarangCache();

  return { success: results, failed };
}
