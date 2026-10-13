import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { StatusApprovalPermintaan, TipeStokItem } from "../../../generated/prisma/enums.js";
import { catatMutasi, getSaldo, lockItem } from "../stokItem/stokItem.js";

export type ApprovalPermintaan = StatusApprovalPermintaan;

export type PermintaanBarItemInput = {
  itemId: number | null;
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
  include: { items: { include: { item: true } } };
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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
    include: { items: { include: { item: true } } },
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
  dari?: Date;
  sampai?: Date;
}): Promise<{ data: PermintaanRecord[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page, limit, approval, dari, sampai } = params;
  const where: Prisma.PermintaanBarangWhereInput = {};
  if (approval) where.approval = approval;
  // Rentang inklusif dua sisi pada kolom tanggal: [awal dari, awal (sampai+1 hari)).
  if (dari || sampai) {
    where.tanggal = {};
    if (dari) where.tanggal.gte = startOfDay(dari);
    if (sampai) where.tanggal.lt = startOfDay(addDays(sampai, 1));
  }
  const [total, data] = await Promise.all([
    prisma.permintaanBarang.count({ where }),
    prisma.permintaanBarang.findMany({
      where,
      include: { items: { include: { item: true } } },
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
    include: { items: { include: { item: true } } },
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
      include: { items: { include: { item: true } } },
    });
  });
}

export type KeputusanItemInput = { id: number; jumlahDisetujui: number };

export class ItemTanpaMasterError extends Error {
  readonly code = "ITEM_TANPA_MASTER";
  constructor(readonly itemIds: number[]) {
    super("Item belum terdaftar di master, pilih item master dulu.");
    this.name = "ItemTanpaMasterError";
  }
}

export class KeputusanItemError extends Error {
  readonly code = "KEPUTUSAN_ITEM_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "KeputusanItemError";
  }
}

/**
 * Setujui/batalkan permintaan dalam satu transaksi.
 * - DISETUJUI: tiap item dapat jumlahDisetujui (0 = ditolak), dibatasi
 *   min(jumlah diminta, saldo stok). Default: min(jumlah, saldo).
 *   Baris KELUAR dibuat untuk tiap item yang disetujui. Permintaan jadi
 *   DISETUJUI jika minimal satu item > 0, selain itu tetap BELUM_DISETUJUI.
 * - BELUM_DISETUJUI: batalkan KELUAR terkait dengan MASUK pembalik, lalu
 *   reset keputusan item ke MENUNGGU.
 */
export async function setApproval(
  id: number,
  approval: ApprovalPermintaan,
  keputusan: KeputusanItemInput[] = [],
  userId: number | null = null,
): Promise<PermintaanRecord | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.permintaanBarang.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return null;

    if (approval === StatusApprovalPermintaan.BELUM_DISETUJUI) {
      if (existing.approval === StatusApprovalPermintaan.DISETUJUI) {
        for (const it of existing.items) {
          if (it.statusKeputusan !== "DISETUJUI" || !it.itemId || !it.jumlahDisetujui) continue;
          await lockItem(tx, it.itemId);
          await catatMutasi(tx, {
            itemId: it.itemId,
            tipe: TipeStokItem.MASUK,
            jumlah: it.jumlahDisetujui,
            sumberPermintaanItemId: it.id,
            keterangan: `Pembatalan approval ${existing.noPermintaan}`,
            userId,
          });
        }
        await tx.permintaanBarangItem.updateMany({
          where: { permintaanId: id },
          data: { statusKeputusan: "MENUNGGU", jumlahDisetujui: null },
        });
      }
      return tx.permintaanBarang.update({
        where: { id },
        data: { approval },
        include: { items: { include: { item: true } } },
      });
    }

    // DISETUJUI
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) return getPermintaanInTx(tx, id);

    const tanpaMaster = existing.items.filter((it) => !it.itemId).map((it) => it.id);
    if (tanpaMaster.length > 0) throw new ItemTanpaMasterError(tanpaMaster);

    const byId = new Map(keputusan.map((k) => [k.id, k.jumlahDisetujui]));
    for (const it of existing.items) {
      if (byId.has(it.id)) {
        const v = byId.get(it.id)!;
        if (!Number.isInteger(v) || v < 0) {
          throw new KeputusanItemError(`jumlahDisetujui item ${it.id} harus bilangan bulat >= 0`);
        }
      }
    }

    let adaDisetujui = false;
    for (const it of existing.items) {
      const itemId = it.itemId!;
      await lockItem(tx, itemId);
      const saldo = await getSaldo(itemId, tx);
      const batas = Math.min(it.jumlah, Math.max(0, saldo));
      const diminta = byId.has(it.id) ? byId.get(it.id)! : batas;
      if (diminta > batas) {
        throw new KeputusanItemError(
          `Item "${it.nama}": jumlah disetujui ${diminta} melebihi batas (stok ${saldo}, diminta ${it.jumlah}).`,
        );
      }
      await tx.permintaanBarangItem.update({
        where: { id: it.id },
        data: {
          jumlahDisetujui: diminta,
          statusKeputusan: diminta > 0 ? "DISETUJUI" : "DITOLAK",
        },
      });
      if (diminta > 0) {
        adaDisetujui = true;
        await catatMutasi(tx, {
          itemId,
          tipe: TipeStokItem.KELUAR,
          jumlah: diminta,
          sumberPermintaanItemId: it.id,
          keterangan: `Approval ${existing.noPermintaan}`,
          userId,
        });
      }
    }

    return tx.permintaanBarang.update({
      where: { id },
      data: {
        approval: adaDisetujui ? StatusApprovalPermintaan.DISETUJUI : StatusApprovalPermintaan.BELUM_DISETUJUI,
      },
      include: { items: { include: { item: true } } },
    });
  });
}

async function getPermintaanInTx(tx: PrismaTransactionClient, id: number): Promise<PermintaanRecord> {
  return tx.permintaanBarang.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { item: true } } },
  });
}

/**
 * Petakan baris permintaan teks bebas ke master Item. Hanya saat
 * BELUM_DISETUJUI; snapshot nama/satuan ikut master supaya konsisten.
 */
export async function petakanItemMaster(permintaanId: number, barangItemId: number, masterItemId: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.permintaanBarang.findUnique({
      where: { id: permintaanId },
      select: { approval: true },
    });
    if (!existing) return null;
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
    const baris = await tx.permintaanBarangItem.findUnique({ where: { id: barangItemId } });
    if (!baris || baris.permintaanId !== permintaanId) return null;
    const master = await tx.item.findUnique({ where: { id: masterItemId } });
    if (!master) return { error: "NOT_FOUND_MASTER" as const };
    return tx.permintaanBarangItem.update({
      where: { id: barangItemId },
      data: { itemId: master.id, nama: master.nama, satuan: master.unit },
      include: { item: true },
    });
  });
}

export async function deletePermintaan(id: number): Promise<boolean> {
  const existing = await prisma.permintaanBarang.findUnique({ where: { id }, select: { approval: true } });
  if (!existing) return false;
  if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
  await prisma.permintaanBarang.delete({ where: { id } });
  return true;
}
