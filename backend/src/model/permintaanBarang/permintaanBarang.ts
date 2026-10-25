import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  SumberPermintaanBarang,
  StatusApprovalPermintaan,
  TipeStokItem,
} from "../../../generated/prisma/enums.js";
import { catatMutasi, getSaldo, lockItem } from "../stokItem/stokItem.js";
import {
  ensureDivisionInventoryLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";

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
  divisiPemintaId?: number | null;
  divisiApproverId?: number | null;
  sumber?: SumberPermintaanBarang;
  autoKey?: string | null;
};

export const PERMINTAAN_INCLUDE = {
  items: { include: { item: true } },
  divisiPeminta: true,
  divisiApprover: true,
} satisfies Prisma.PermintaanBarangInclude;

export type PermintaanRecord = Prisma.PermintaanBarangGetPayload<{
  include: typeof PERMINTAAN_INCLUDE;
}>;

export class PermintaanTerkunciError extends Error {
  readonly code = "PERMINTAAN_TERKUNCI";
  constructor() {
    super("Permintaan sudah disetujui, tidak dapat diubah.");
    this.name = "PermintaanTerkunciError";
  }
}

export class PermintaanOtomatisError extends Error {
  readonly code = "PERMINTAAN_OTOMATIS";
  constructor() {
    super("Permintaan otomatis hasil produksi tidak dapat diubah.");
    this.name = "PermintaanOtomatisError";
  }
}

export class DivisiApprovalError extends Error {
  readonly code = "DIVISI_TIDAK_BERHAK";
  constructor(message = "Anda tidak berhak menyetujui permintaan untuk divisi ini.") {
    super(message);
    this.name = "DivisiApprovalError";
  }
}

export class ItemDivisiError extends Error {
  readonly code = "ITEM_DIVISI_TIDAK_COCOK";
  constructor(namaItem: string) {
    super(`Item "${namaItem}" tidak berasal dari divisi approver permintaan ini.`);
    this.name = "ItemDivisiError";
  }
}

export class DivisiPemintaError extends Error {
  readonly code = "DIVISI_PEMINTA_TIDAK_DITEMUKAN";
  constructor() {
    super("Divisi peminta tidak ditemukan; approval tidak dapat membuat WIP.");
    this.name = "DivisiPemintaError";
  }
}

export class PemakaianDipakaiProduksiError extends Error {
  readonly code = "PEMAKAIAN_DIPAKAI_PRODUKSI";
  constructor() {
    super("Pemakaian material sudah dipakai produksi, approval tidak dapat dibatalkan.");
    this.name = "PemakaianDipakaiProduksiError";
  }
}

export class PemakaianSudahTransferError extends Error {
  readonly code = "PEMAKAIAN_SUDAH_TRANSFER";
  constructor() {
    super("Pemakaian material sudah dipakai transfer WIP, approval tidak dapat dibatalkan.");
    this.name = "PemakaianSudahTransferError";
  }
}

export class ItemSmGunakanWipError extends Error {
  readonly code = "ITEM_SM_GUNAKAN_WIP";
  constructor(readonly items: { kode: string; nama: string }[]) {
    super("Item SM tidak dapat diminta lewat gudang; gunakan Transfer WIP dari divisi pemilik.");
    this.name = "ItemSmGunakanWipError";
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

async function resolveDivisiPeminta(
  tx: PrismaTransactionClient,
  departemen: string,
): Promise<number | null> {
  const target = departemen.trim().toLowerCase();
  if (!target) return null;
  const rows = await tx.divisi.findMany({ select: { id: true, nama: true } });
  return rows.find((d) => d.nama.trim().toLowerCase() === target)?.id ?? null;
}

async function resolveApproverDariItems(
  tx: PrismaTransactionClient,
  items: PermintaanBarItemInput[],
): Promise<number | null> {
  if (items.length === 0 || items.some((item) => item.itemId === null)) return null;
  const ids = [...new Set(items.map((item) => item.itemId as number))];
  const rows = await tx.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, divisiId: true },
  });
  if (rows.length !== ids.length) return null;
  const divisi = new Set(rows.map((row) => row.divisiId));
  if (divisi.size !== 1) return null;
  return [...divisi][0] ?? null;
}

async function pastikanBukanItemSm(
  tx: PrismaTransactionClient,
  items: Array<{ itemId: number | null }>,
): Promise<void> {
  const ids = [
    ...new Set(
      items
        .map((item) => item.itemId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];
  if (ids.length === 0) return;
  const rows = await tx.item.findMany({
    where: { id: { in: ids }, jenis: "SM" },
    select: { kode: true, nama: true },
  });
  if (rows.length > 0) throw new ItemSmGunakanWipError(rows);
}

async function insertPermintaan(
  tx: PrismaTransactionClient,
  input: PermintaanInput,
): Promise<PermintaanRecord> {
  await pastikanBukanItemSm(tx, input.items);
  const noPermintaan = await generateNoPermintaan(tx, input.tanggal);
  const divisiPemintaId =
    input.divisiPemintaId !== undefined
      ? input.divisiPemintaId
      : await resolveDivisiPeminta(tx, input.departemen);
  const divisiApproverId =
    input.divisiApproverId !== undefined
      ? input.divisiApproverId
      : await resolveApproverDariItems(tx, input.items);
  const sumber = input.sumber ?? SumberPermintaanBarang.MANUAL;

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
      divisiPemintaId,
      divisiApproverId,
      sumber,
      autoKey: sumber === SumberPermintaanBarang.HASIL_PRODUKSI ? (input.autoKey ?? null) : null,
      items: { create: input.items },
    },
    include: PERMINTAAN_INCLUDE,
  });
}

async function reusePermintaanOtomatis(input: PermintaanInput): Promise<PermintaanRecord | null> {
  if (!input.autoKey) return null;
  const existing = await prisma.permintaanBarang.findFirst({
    where: {
      autoKey: input.autoKey,
      approval: StatusApprovalPermintaan.BELUM_DISETUJUI,
    },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM PermintaanBarang WHERE id = ${existing.id} FOR UPDATE`;
    const current = await tx.permintaanBarang.findUnique({
      where: { id: existing.id },
      select: { autoKey: true, approval: true },
    });
    if (
      !current ||
      current.autoKey !== input.autoKey ||
      current.approval !== StatusApprovalPermintaan.BELUM_DISETUJUI
    ) {
      return null;
    }

    for (const item of input.items) {
      if (item.itemId === null) continue;
      await tx.permintaanBarangItem.updateMany({
        where: { permintaanId: existing.id, itemId: item.itemId },
        data: { jumlah: item.jumlah },
      });
    }
    return getPermintaanInTx(tx, existing.id);
  });
}

export async function createPermintaan(input: PermintaanInput): Promise<PermintaanRecord> {
  try {
    return await prisma.$transaction((tx) => insertPermintaan(tx, input));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    if (input.autoKey) {
      const existing = await reusePermintaanOtomatis(input);
      if (existing) return existing;
    }

    // Ulangi sekali: nomor bisa sudah dipakai request lain, atau autoKey
    // baru saja dilepas oleh transaksi yang kalah race.
    return prisma.$transaction((tx) => insertPermintaan(tx, input));
  }
}

export async function listPermintaan(params: {
  page: number;
  limit: number;
  approval?: ApprovalPermintaan;
  dari?: Date;
  sampai?: Date;
  divisiPemintaId?: number;
  divisiApproverId?: number;
  sumber?: SumberPermintaanBarang;
}): Promise<{ data: PermintaanRecord[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page, limit, approval, dari, sampai, divisiPemintaId, divisiApproverId, sumber } = params;
  const where: Prisma.PermintaanBarangWhereInput = {};
  if (approval) where.approval = approval;
  if (divisiPemintaId) where.divisiPemintaId = divisiPemintaId;
  if (divisiApproverId) where.divisiApproverId = divisiApproverId;
  if (sumber) where.sumber = sumber;
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
      include: PERMINTAAN_INCLUDE,
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
    include: PERMINTAAN_INCLUDE,
  });
}

export async function updatePermintaan(id: number, input: PermintaanInput): Promise<PermintaanRecord | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM PermintaanBarang WHERE id = ${id} FOR UPDATE`;

    const existing = await tx.permintaanBarang.findUnique({
      where: { id },
      select: { approval: true, sumber: true },
    });
    if (!existing) return null;
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
    if (existing.sumber === SumberPermintaanBarang.HASIL_PRODUKSI) throw new PermintaanOtomatisError();
    await pastikanBukanItemSm(tx, input.items);

    const divisiPemintaId = await resolveDivisiPeminta(tx, input.departemen);
    const divisiApproverId = await resolveApproverDariItems(tx, input.items);

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
        divisiPemintaId,
        divisiApproverId,
        items: { create: input.items },
      },
      include: PERMINTAAN_INCLUDE,
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

async function resolveActor(
  tx: PrismaTransactionClient,
  userId: number | null,
): Promise<{ role: string; divisiId: number | null } | null> {
  if (userId === null) return null;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, divisiId: true },
  });
  if (!user) throw new DivisiApprovalError("Akun approval tidak ditemukan.");
  return user;
}

function approverDariRows(
  rows: { itemId: number | null; item: { divisiId: number | null } | null }[],
): number | null {
  if (rows.length === 0 || rows.some((row) => row.itemId === null || !row.item)) return null;
  const values = rows.map((row) => row.item!.divisiId);
  if (values.some((value) => value === null)) return null;
  const first = values[0]!;
  return values.every((value) => value === first) ? first : null;
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
    await tx.$queryRaw`SELECT id FROM PermintaanBarang WHERE id = ${id} FOR UPDATE`;

    const existing = await tx.permintaanBarang.findUnique({
      where: { id },
      include: { items: { include: { item: true } } },
    });
    if (!existing) return null;

    const actor = await resolveActor(tx, userId);
    const isAdmin = actor === null || actor.role === "admin";
    if (!isAdmin) {
      if (
        actor.divisiId === null ||
        existing.divisiApproverId === null ||
        existing.divisiApproverId !== actor.divisiId
      ) {
        throw new DivisiApprovalError();
      }
    }

    const divisiPemintaId =
      existing.divisiPemintaId ?? (await resolveDivisiPeminta(tx, existing.departemen));

    if (approval === StatusApprovalPermintaan.DISETUJUI) {
      const itemSm = existing.items
        .filter((item) => item.item?.jenis === "SM")
        .map((item) => ({
          kode: item.item?.kode ?? "",
          nama: item.item?.nama ?? item.nama,
        }));
      if (itemSm.length > 0) throw new ItemSmGunakanWipError(itemSm);
    }

    if (approval === StatusApprovalPermintaan.BELUM_DISETUJUI) {
      if (existing.approval === StatusApprovalPermintaan.DISETUJUI) {
        const dipakaiProduksi = await tx.hasilProduksiPemakaian.findFirst({
          where: { pemakaianMaterialItem: { pemakaian: { permintaanId: id } } },
          select: { id: true },
        });
        if (dipakaiProduksi) throw new PemakaianDipakaiProduksiError();

        const dipakaiTransfer = await tx.wipTransferAlokasi.findFirst({
          where: {
            pemakaianMaterialItem: { pemakaian: { permintaanId: id } },
          },
          select: { id: true },
        });
        if (dipakaiTransfer) throw new PemakaianSudahTransferError();

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
        await tx.pemakaianMaterial.deleteMany({
          where: { permintaanId: id },
        });
      }
      return tx.permintaanBarang.update({
        where: { id },
        data: {
          approval,
          autoKey: null,
          ...(divisiPemintaId !== null ? { divisiPemintaId } : {}),
        },
        include: PERMINTAAN_INCLUDE,
      });
    }

    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) {
      return getPermintaanInTx(tx, id);
    }

    if (divisiPemintaId === null) throw new DivisiPemintaError();

    const tanpaMaster = existing.items.filter((it) => !it.itemId).map((it) => it.id);
    if (tanpaMaster.length > 0) throw new ItemTanpaMasterError(tanpaMaster);

    if (!isAdmin) {
      for (const it of existing.items) {
        const itemDivisiId = it.item?.divisiId ?? null;
        const fallback = itemDivisiId === null && existing.divisiApproverId === divisiPemintaId;
        if (!fallback && itemDivisiId !== existing.divisiApproverId) {
          throw new ItemDivisiError(it.nama);
        }
      }
    }

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
    const autoPemakaianItems: { itemId: number; permintaanBarangItemId: number; jumlahDisetujui: number; satuan: string | null }[] = [];
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
        autoPemakaianItems.push({
          itemId,
          permintaanBarangItemId: it.id,
          jumlahDisetujui: diminta,
          satuan: it.satuan ?? null,
        });
      }
    }

    if (adaDisetujui && autoPemakaianItems.length > 0) {
      const existingPemakaian = await tx.pemakaianMaterial.findFirst({
        where: { permintaanId: id },
        select: { id: true },
      });
      if (!existingPemakaian) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const prefix = `PM-${yyyy}${mm}${dd}-`;
        const terakhir = await tx.pemakaianMaterial.findFirst({
          where: { nomor: { startsWith: prefix } },
          orderBy: { nomor: "desc" },
          select: { nomor: true },
        });
        const urut = terakhir ? Number(terakhir.nomor.slice(prefix.length)) + 1 : 1;

        const createPemakaian = async (nomor: string) => {
          return tx.pemakaianMaterial.create({
            data: {
              nomor,
              permintaanId: id,
              divisiId: divisiPemintaId,
              tanggal: now,
              userId,
              keterangan: "Dibuat otomatis dari approval permintaan barang",
              items: {
                create: autoPemakaianItems.map((item) => ({
                  permintaanBarangItemId: item.permintaanBarangItemId,
                  itemId: item.itemId,
                  jumlahDiterima: item.jumlahDisetujui,
                  jumlahDipakai: 0,
                  jumlahSisa: item.jumlahDisetujui,
                  satuan: item.satuan,
                })),
              },
            },
            select: {
              items: {
                select: {
                  id: true,
                  itemId: true,
                  jumlahDiterima: true,
                },
              },
            },
          });
        };

        let receipt;
        try {
          receipt = await createPemakaian(`${prefix}${String(urut).padStart(4, "0")}`);
        } catch (error) {
          if ((error as { code?: string } | null)?.code !== "P2002") throw error;
          receipt = await createPemakaian(`${prefix}${String(urut + 1).padStart(4, "0")}`);
        }

        const location = await ensureDivisionInventoryLocation(tx, divisiPemintaId);
        for (const item of receipt.items) {
          if (item.itemId === null || Number(item.jumlahDiterima) <= 0) continue;
          await postInventoryMovementInTransaction(tx, {
            itemId: item.itemId,
            pemakaianMaterialItemId: item.id,
            toLocationId: location.id,
            type: "OPENING",
            quantity: Number(item.jumlahDiterima),
            idempotencyKey: `wip-receipt:${item.id}`,
            sourceType: "MATERIAL_ISSUE",
            sourceId: `${id}:${item.id}`,
            reason: `Material diterima divisi melalui approval ${existing.noPermintaan}`,
            userId,
            occurredAt: now,
          });
        }
      }
    }

    return tx.permintaanBarang.update({
      where: { id },
      data: {
        approval: adaDisetujui ? StatusApprovalPermintaan.DISETUJUI : StatusApprovalPermintaan.BELUM_DISETUJUI,
        divisiPemintaId,
        ...(adaDisetujui ? { autoKey: null } : {}),
      },
      include: PERMINTAAN_INCLUDE,
    });
  });
}

async function getPermintaanInTx(tx: PrismaTransactionClient, id: number): Promise<PermintaanRecord> {
  return tx.permintaanBarang.findUniqueOrThrow({
    where: { id },
    include: PERMINTAAN_INCLUDE,
  });
}

/**
 * Petakan baris permintaan teks bebas ke master Item. Hanya saat
 * BELUM_DISETUJUI; snapshot nama/satuan ikut master supaya konsisten.
 */
export async function petakanItemMaster(permintaanId: number, barangItemId: number, masterItemId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM PermintaanBarang WHERE id = ${permintaanId} FOR UPDATE`;

    const existing = await tx.permintaanBarang.findUnique({
      where: { id: permintaanId },
      select: {
        approval: true,
        sumber: true,
        divisiPemintaId: true,
        divisiApproverId: true,
      },
    });
    if (!existing) return null;
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
    if (existing.sumber === SumberPermintaanBarang.HASIL_PRODUKSI) throw new PermintaanOtomatisError();

    const baris = await tx.permintaanBarangItem.findUnique({ where: { id: barangItemId } });
    if (!baris || baris.permintaanId !== permintaanId) return null;
    const master = await tx.item.findUnique({ where: { id: masterItemId } });
    if (!master) return { error: "NOT_FOUND_MASTER" as const };
    if (master.jenis === "SM") {
      throw new ItemSmGunakanWipError([
        { kode: master.kode, nama: master.nama },
      ]);
    }

    if (existing.divisiApproverId !== null) {
      const fallback = master.divisiId === null && existing.divisiApproverId === existing.divisiPemintaId;
      if (!fallback && master.divisiId !== existing.divisiApproverId) {
        throw new ItemDivisiError(master.nama);
      }
    }

    const updated = await tx.permintaanBarangItem.update({
      where: { id: barangItemId },
      data: { itemId: master.id, nama: master.nama, satuan: master.unit },
      include: { item: true },
    });

    if (existing.divisiApproverId === null) {
      const rows = await tx.permintaanBarangItem.findMany({
        where: { permintaanId },
        select: { itemId: true, item: { select: { divisiId: true } } },
      });
      await tx.permintaanBarang.update({
        where: { id: permintaanId },
        data: { divisiApproverId: approverDariRows(rows) },
      });
    }

    return updated;
  });
}

export async function deletePermintaan(id: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM PermintaanBarang WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.permintaanBarang.findUnique({ where: { id }, select: { approval: true } });
    if (!existing) return false;
    if (existing.approval === StatusApprovalPermintaan.DISETUJUI) throw new PermintaanTerkunciError();
    await tx.permintaanBarang.delete({ where: { id } });
    return true;
  });
}
