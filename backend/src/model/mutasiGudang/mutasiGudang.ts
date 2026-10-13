import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { clearBarangCache } from "../../lib/barangCache.js";

export class MutasiError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MutasiError";
    this.status = status;
  }
}

export interface MutasiInput {
  barangId: number;
  gudangAsalId: number | null;
  gudangTujuanId: number | null;
  keterangan?: string;
  userId: number | null;
}

const mutasiInclude = {
  barang: { select: { id: true, kodeBarang: true, status: true } },
  gudangAsal: { select: { id: true, kode: true, name: true } },
  gudangTujuan: { select: { id: true, kode: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
};

/**
 * Catat mutasi gudang secara atomik: update Barang.gudangId + insert
 * RiwayatMutasiGudang dalam satu transaksi. jumlah selalu 1 karena satu
 * Barang = satu unit helm.
 */
export async function catatMutasi(input: MutasiInput) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const barang = await tx.barang.findUnique({
      where: { id: input.barangId },
      select: { id: true, gudangId: true },
    });
    if (!barang) throw new MutasiError("Barang tidak ditemukan", 404);

    const lokasiKini = barang.gudangId ?? null;
    if (input.gudangAsalId !== lokasiKini) {
      throw new MutasiError("Gudang asal tidak sesuai lokasi barang saat ini", 409);
    }
    if (input.gudangAsalId !== null && input.gudangAsalId === input.gudangTujuanId) {
      throw new MutasiError("Gudang asal dan tujuan tidak boleh sama", 400);
    }

    for (const gid of [input.gudangAsalId, input.gudangTujuanId]) {
      if (gid === null) continue;
      const gudang = await tx.gudang.findUnique({ where: { id: gid }, select: { id: true } });
      if (!gudang) throw new MutasiError(`Gudang dengan id ${gid} tidak ditemukan`, 404);
    }

    await tx.barang.update({
      where: { id: input.barangId },
      data: { gudangId: input.gudangTujuanId },
    });

    const row = await tx.riwayatMutasiGudang.create({
      data: {
        barangId: input.barangId,
        gudangAsalId: input.gudangAsalId,
        gudangTujuanId: input.gudangTujuanId,
        jumlah: 1,
        keterangan: input.keterangan,
        userId: input.userId,
      },
      include: mutasiInclude,
    });

    await clearBarangCache();
    return row;
  });
}

export interface MutasiBulkInput {
  barangIds: number[];
  gudangTujuanId: number | null;
  keterangan?: string;
  userId: number | null;
}

/**
 * Mutasi massal satu tujuan, all-or-nothing: gudang asal diambil dari
 * lokasi kini tiap barang. Gagal di satu item = seluruh transaksi batal,
 * tidak ada lokasi berubah tanpa riwayat.
 */
export async function catatMutasiBulk(input: MutasiBulkInput) {
  const ids = [...new Set(input.barangIds)];
  const rows = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    if (input.gudangTujuanId !== null) {
      const tujuan = await tx.gudang.findUnique({
        where: { id: input.gudangTujuanId },
        select: { id: true },
      });
      if (!tujuan) throw new MutasiError(`Gudang dengan id ${input.gudangTujuanId} tidak ditemukan`, 404);
    }

    const barangs = await tx.barang.findMany({
      where: { id: { in: ids } },
      select: { id: true, kodeBarang: true, gudangId: true },
    });
    const found = new Map(barangs.map((b) => [b.id, b]));
    const hilang = ids.filter((id) => !found.has(id));
    if (hilang.length > 0) {
      throw new MutasiError(`Barang tidak ditemukan: ${hilang.join(", ")}`, 404);
    }

    for (const b of barangs) {
      const asal = b.gudangId ?? null;
      if (asal !== null && asal === input.gudangTujuanId) {
        throw new MutasiError(`Barang ${b.kodeBarang} sudah di gudang tujuan`, 400);
      }
    }

    await tx.barang.updateMany({
      where: { id: { in: ids } },
      data: { gudangId: input.gudangTujuanId },
    });

    await tx.riwayatMutasiGudang.createMany({
      data: barangs.map((b) => ({
        barangId: b.id,
        gudangAsalId: b.gudangId,
        gudangTujuanId: input.gudangTujuanId,
        jumlah: 1,
        keterangan: input.keterangan,
        userId: input.userId,
      })),
    });

    return tx.riwayatMutasiGudang.findMany({
      where: { barangId: { in: ids } },
      orderBy: { id: "desc" },
      take: ids.length,
      include: mutasiInclude,
    });
  });

  await clearBarangCache();
  return { success: rows, summary: { total: ids.length, success: rows.length, failed: 0 } };
}

export interface MutasiFilter {
  page: number;
  limit: number;
  barangId?: number;
  kodeBarang?: string;
  gudangId?: number;
  dari?: Date;
  sampai?: Date;
}

export async function listMutasi(filter: MutasiFilter) {
  const { page, limit, barangId, kodeBarang, gudangId, dari, sampai } = filter;
  const where: Prisma.RiwayatMutasiGudangWhereInput = {};
  if (barangId !== undefined) where.barangId = barangId;
  if (kodeBarang) where.barang = { kodeBarang: { contains: kodeBarang } };
  if (gudangId !== undefined) where.OR = [{ gudangAsalId: gudangId }, { gudangTujuanId: gudangId }];
  if (dari || sampai) {
    where.tanggal = {};
    if (dari) where.tanggal.gte = dari;
    if (sampai) {
      const besok = new Date(sampai);
      besok.setDate(besok.getDate() + 1);
      where.tanggal.lt = besok;
    }
  }

  const [total, data] = await prisma.$transaction([
    prisma.riwayatMutasiGudang.count({ where }),
    prisma.riwayatMutasiGudang.findMany({
      where,
      include: mutasiInclude,
      orderBy: { tanggal: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getMutasiByBarang(barangId: number, limit = 100) {
  return prisma.riwayatMutasiGudang.findMany({
    where: { barangId },
    include: mutasiInclude,
    orderBy: { tanggal: "desc" },
    take: Math.min(500, Math.max(1, limit)),
  });
}

export async function getMutasiByGudang(gudangId: number, limit = 100) {
  return prisma.riwayatMutasiGudang.findMany({
    where: { OR: [{ gudangAsalId: gudangId }, { gudangTujuanId: gudangId }] },
    include: mutasiInclude,
    orderBy: { tanggal: "desc" },
    take: Math.min(500, Math.max(1, limit)),
  });
}
