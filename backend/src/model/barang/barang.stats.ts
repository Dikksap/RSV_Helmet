import { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../lib/prisma.js";
import type { StatusBarang } from "./barang.status.js";

export type FinishgoodPerBulanRow = {
  bulan: string;
  tahun: number;
  bulanAngka: number;
  variantId: number;
  productId: number;
  jumlah: number;
};

export type FinishgoodPerBulanFilter = {
  variantId?: number;
  productId?: number;
  tanggalAwal?: Date;
  tanggalAkhir?: Date;
};

type StatusGroup = { status: string; _count: { _all: number } };
type VariantGroup = { variantId: number; _count: { _all: number } };
type BatchGroup = { batchId: number | null; _count: { _all: number } };
type VariantDetails = {
  id: number;
  product: { nama: string };
  style: { nama: string };
  color: { nama: string };
  size: { nama: string };
};
type BatchDetails = { id: number; nomorBatch: number };

export async function getStatusSummary(): Promise<{
  total: number;
  perStatus: Record<StatusBarang, number>;
}> {
  const groups = await prisma.barang.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { status: "asc" },
  });

  const perStatus: Record<StatusBarang, number> = {
    REGISTER: 0,
    FINISHGOOD: 0,
    RETUR: 0,
    OUT: 0,
    BAD: 0,
  };

  let total = 0;
  for (const group of groups) {
    const status = group.status as StatusBarang;
    const count = (group._count as { _all: number })._all ?? 0;
    perStatus[status] = count;
    total += count;
  }

  return { total, perStatus };
}

export async function getBarangStats(filter: {
  variantId?: number;
  batchId?: number;
}): Promise<{
  total: number;
  perStatus: Record<StatusBarang, number>;
  perVariant: { variantId: number; nama: string; total: number }[];
  perBatch: { batchId: number; nomorBatch: string; total: number }[];
}> {
  const where: { variantId?: number; batchId?: number } = {};
  if (filter.variantId !== undefined) where.variantId = filter.variantId;
  if (filter.batchId !== undefined) where.batchId = filter.batchId;

  const batchWhere: { variantId?: number; batchId?: number; status?: { not: "REGISTER" } } = {
    status: { not: "REGISTER" },
  };
  if (filter.variantId !== undefined) batchWhere.variantId = filter.variantId;
  if (filter.batchId !== undefined) batchWhere.batchId = filter.batchId;

  const [statusGroups, variantGroups, batchGroups, totalCount] =
    (await prisma.$transaction([
      prisma.barang.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      prisma.barang.groupBy({
        by: ["variantId"],
        where,
        _count: { _all: true },
        orderBy: { variantId: "asc" },
      }),
      prisma.barang.groupBy({
        by: ["batchId"],
        where: batchWhere,
        _count: { _all: true },
        orderBy: { batchId: "asc" },
      }),
      prisma.barang.count({ where }),
    ])) as [StatusGroup[], VariantGroup[], BatchGroup[], number];

  const perStatus: Record<StatusBarang, number> = {
    REGISTER: 0,
    FINISHGOOD: 0,
    RETUR: 0,
    OUT: 0,
    BAD: 0,
  };

  for (const group of statusGroups) {
    perStatus[group.status as StatusBarang] =
      (group._count as { _all: number })._all ?? 0;
  }

  const variantIds = variantGroups.map((group) => group.variantId);
  const variants: VariantDetails[] = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true, style: true, color: true, size: true },
  });

  const variantMap = new Map<number, string>(
    variants.map((variant) => [
      variant.id,
      `${variant.product.nama} - ${variant.style.nama} - ${variant.color.nama} - ${variant.size.nama}`,
    ]),
  );

  const perVariant = variantGroups
    .map((group) => ({
      variantId: group.variantId,
      nama: variantMap.get(group.variantId) ?? `V${group.variantId}`,
      total: (group._count as { _all: number })._all ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const batchIds = batchGroups.map((group) => group.batchId).filter((id): id is number => id !== null);
  const batches: BatchDetails[] = await prisma.productionBatch.findMany({
    where: { id: { in: batchIds } },
    select: { id: true, nomorBatch: true },
  });

  const batchMap = new Map<number, number>(
    batches.map((batch) => [batch.id, batch.nomorBatch]),
  );

  const perBatch = batchGroups
    .filter((group) => group.batchId !== null)
    .map((group) => ({
      batchId: group.batchId as number,
      nomorBatch: `BC${String(batchMap.get(group.batchId!) ?? 0).padStart(3, "0")}`,
      total: (group._count as { _all: number })._all ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { total: totalCount, perStatus, perVariant, perBatch };
}

/** Bangun WHERE clause parameterized dari filter query params */
function buildFinishgoodWhere(filter: FinishgoodPerBulanFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`];

  if (filter.variantId !== undefined) conditions.push(Prisma.sql`v.variantId = ${filter.variantId}`);
  if (filter.productId !== undefined) conditions.push(Prisma.sql`v.productId = ${filter.productId}`);
  if (filter.tanggalAwal !== undefined) conditions.push(Prisma.sql`v.bulan >= ${formatBulanKey(filter.tanggalAwal)}`);
  if (filter.tanggalAkhir !== undefined) conditions.push(Prisma.sql`v.bulan <= ${formatBulanKey(filter.tanggalAkhir)}`);

  return Prisma.join(conditions, " AND ");
}

/** Format Date menjadi key bulan "YYYY-MM" untuk dibandingkan dengan kolom view */
function formatBulanKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getFinishgoodPerBulan(
  filter: FinishgoodPerBulanFilter = {},
): Promise<{
  data: FinishgoodPerBulanRow[];
  meta: { variantId?: number; productId?: number };
}> {
  const where = buildFinishgoodWhere(filter);

  const rows = await prisma.$queryRaw<FinishgoodPerBulanRow[]>`
    SELECT v.bulan, v.tahun, v.bulanAngka, v.variantId, v.productId, v.jumlah
    FROM ViewBarangFinishgoodPerBulan v
    WHERE ${where}
    ORDER BY v.tahun ASC, v.bulanAngka ASC, v.variantId ASC`;

  const data = rows.map((row: FinishgoodPerBulanRow) => ({ ...row, jumlah: Number(row.jumlah) }));

  return { data, meta: { variantId: filter.variantId, productId: filter.productId } };
}

// =============================================
// Rentang tanggal per batch (SELESAI & AKTIF)
// =============================================

export type BatchRentangFilter = {
  tanggalAwal?: Date;
  tanggalAkhir?: Date;
};

export type BatchRentangRow = {
  batchId: number;
  nomorBatch: string;
  jumlah: number;
  tanggalMulai: Date | null;
  tanggalSelesai: Date | null;
};

type BatchRentangRawRow = {
  batchId: number;
  nomorBatch: number;
  totalProduksi: number;
  jumlahNonRegister: bigint | number | null;
  tanggalMulai: Date | null;
  tanggalSelesai: Date | null;
};

function formatNomorBatch(nomor: number): string {
  return `BC${String(nomor).padStart(3, "0")}`;
}

function buildBatchRentangWhere(
  filter: BatchRentangFilter,
  column: "tanggalMulai" | "tanggalSelesai",
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (filter.tanggalAwal !== undefined) conditions.push(Prisma.sql`v.${Prisma.raw(column)} >= ${filter.tanggalAwal}`);
  if (filter.tanggalAkhir !== undefined) conditions.push(Prisma.sql`v.${Prisma.raw(column)} <= ${filter.tanggalAkhir}`);
  return Prisma.join(conditions, " AND ");
}

export async function getBatchRentangTanggal(
  filter: BatchRentangFilter = {},
): Promise<{
  selesai: BatchRentangRow[];
  aktif: BatchRentangRow[];
}> {
  const [selesaiRows, aktifRows] = await prisma.$transaction([
    prisma.$queryRaw<BatchRentangRawRow[]>`
      SELECT v.batchId, v.nomorBatch, v.jumlahNonRegister, v.tanggalMulai, v.tanggalSelesai
      FROM ViewBatchRentangTanggal v
      WHERE v.status = 'SELESAI' AND ${buildBatchRentangWhere(filter, "tanggalSelesai")}
      ORDER BY v.tanggalSelesai ASC, v.nomorBatch ASC`,
    prisma.$queryRaw<BatchRentangRawRow[]>`
      SELECT v.batchId, v.nomorBatch, v.jumlahNonRegister, v.tanggalMulai, v.tanggalSelesai
      FROM ViewBatchRentangTanggal v
      WHERE v.status = 'AKTIF' AND ${buildBatchRentangWhere(filter, "tanggalMulai")}
      ORDER BY v.nomorBatch ASC`,
  ]);

  const mapRow = (row: BatchRentangRawRow, endDate: Date | null): BatchRentangRow => ({
    batchId: row.batchId,
    nomorBatch: formatNomorBatch(row.nomorBatch),
    jumlah: Number(row.jumlahNonRegister ?? 0),
    tanggalMulai: row.tanggalMulai ? new Date(row.tanggalMulai) : null,
    tanggalSelesai: endDate
      ? new Date(endDate)
      : row.tanggalSelesai
        ? new Date(row.tanggalSelesai)
        : null,
  });

  const selesai = selesaiRows.map((row: BatchRentangRawRow) => mapRow(row, row.tanggalSelesai));
  const aktif = aktifRows.map((row: BatchRentangRawRow) => mapRow(row, new Date()));

  return { selesai, aktif };
}
