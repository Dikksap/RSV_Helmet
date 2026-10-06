import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { StatusApprovalPermintaan } from "../../../generated/prisma/enums.js";

export type ApprovalPermintaan = StatusApprovalPermintaan;

export type PermintaanBarItemInput = {
  nama: string;
  spesifikasi: string | null;
  jumlah: number;
  satuan: string | null;
};

export type PermintaanInput = {
  tanggal: Date;
  departemen: string;
  namaPeminta: string;
  kebutuhanUntuk: string;
  prioritas: string;
  tanggalDibutuhkan: Date | null;
  alasan: string;
  items: PermintaanBarItemInput[];
};

export type PermintaanRecord = Prisma.PermintaanBarangGetPayload<{
  include: { items: true };
}>;

export class PermintaanTerkunciError extends Error {
  readonly code = "PERMINTAAN_TERKUNCI";
  constructor() {
    super("Permintaan sudah disetujui, tidak dapat diubah.");
    this.name = "PermintaanTerkunciError";
  }
}

const NO_PREFIX = "PR-";

function tanggalPrefix(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${NO_PREFIX}${yyyy}${mm}${dd}-`;
}

// Nomor urut per hari. Panjang tetap 19 char (PR + 8 + - + 4) sehingga
// urutan leksikografis sama dengan urutan numerik.
async function generateNoPermintaan(tx: PrismaTransactionClient, date: Date): Promise<string> {
  const prefix = tanggalPrefix(date);
  const terakhir = await tx.permintaanBarang.findFirst({
    where: { noPermintaan: { startsWith: prefix } },
    orderBy: { noPermintaan: "desc" },
    select: { noPermintaan: true },
  });
  const urut = terakhir ? Number(terakhir.noPermintaan.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(urut).padStart(4, "0")}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

async function insertPermintaan(tx: PrismaTransactionClient, input: PermintaanInput): Promise<PermintaanRecord> {
  const noPermintaan = await generateNoPermintaan(tx, input.tanggal);
  return tx.permintaanBarang.create({
    data: {
      noPermintaan,
      tanggal: input.tanggal,
      departemen: input.departemen,
      namaPeminta: input.namaPeminta,
      kebutuhanUntuk: input.kebutuhanUntuk,
      prioritas: input.prioritas,
      tanggalDibutuhkan: input.tanggalDibutuhkan,
      alasan: input.alasan,
      items: { create: input.items },
    },
    include: { items: true },
  });
}

export async function createPermintaan(input: PermintaanInput): Promise<PermintaanRecord> {
  try {
    return await prisma.$transaction((tx) => insertPermintaan(tx, input));
  } catch (error) {
    // Race dua operator pada nomor yang sama: ulangi sekali dengan nomor baru.
    if (!isUniqueViolation(error)) throw error;
    return prisma.$transaction((tx) => insertPermintaan(tx, input));
  }
}

export async function listPermintaan(params: {
  page: number;
  limit: number;
  approval?: ApprovalPermintaan;
}): Promise<{ data: PermintaanRecord[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page, limit, approval } = params;
  const where = approval ? { approval } : {};
  const [total, data] = await Promise.all([
    prisma.permintaanBarang.count({ where }),
    prisma.permintaanBarang.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function getPermintaanById(id: number): Promise<PermintaanRecord | null> {
  return prisma.permintaanBarang.findUnique({
    where: { id },
    include: { items: true },
  });
}

export async function updatePermintaan(id: number, input: PermintaanInput): Promise<PermintaanRecord | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.permintaanBarang.findUnique({ where: { id }, select: { approval: true } });
    if (!existing) return null;
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();

    await tx.permintaanBarangItem.deleteMany({ where: { permintaanId: id } });
    return tx.permintaanBarang.update({
      where: { id },
      data: {
        tanggal: input.tanggal,
        departemen: input.departemen,
        namaPeminta: input.namaPeminta,
        kebutuhanUntuk: input.kebutuhanUntuk,
        prioritas: input.prioritas,
        tanggalDibutuhkan: input.tanggalDibutuhkan,
        alasan: input.alasan,
        items: { create: input.items },
      },
      include: { items: true },
    });
  });
}

export async function setApproval(id: number, approval: ApprovalPermintaan): Promise<PermintaanRecord | null> {
  try {
    return await prisma.permintaanBarang.update({
      where: { id },
      data: { approval },
      include: { items: true },
    });
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") return null;
    throw error;
  }
}

export async function deletePermintaan(id: number): Promise<boolean> {
  const existing = await prisma.permintaanBarang.findUnique({ where: { id }, select: { approval: true } });
  if (!existing) return false;
  if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
  await prisma.permintaanBarang.delete({ where: { id } });
  return true;
}
