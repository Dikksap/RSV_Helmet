import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { SumberPemakaianMaterial } from "../../../generated/prisma/enums.js";
import { getWipRows } from "../wip/wip.js";
import {
  ensureDivisionInventoryLocation,
  InventoryError,
  postInventoryMovementInTransaction,
  receiveItemToDivision,
} from "../inventory/inventory.js";
import { awalHariBisnis } from "../../lib/tanggalBisnis.js";

export type PemakaianItemInput = {
  permintaanBarangItemId: number;
  jumlahSisa: number;
  satuan?: string | null;
  keteranganSisa?: string | null;
  // jumlahDiterima/jumlahDipakai diturunkan backend dari stok divisi terakhir.
  // Field lama tetap diterima agar klien lama tidak error, tapi diabaikan.
  jumlahDiterima?: number;
  jumlahDipakai?: number;
};

export type PemakaianInput = {
  permintaanId: number;
  divisiId: number;
  tanggal?: Date | null;
  keterangan?: string | null;
  items: PemakaianItemInput[];
};

export type PemakaianRecord = Prisma.PemakaianMaterialGetPayload<{
  include: {
    permintaan: { include: { items: { include: { item: true } } } };
    divisi: true;
    user: { select: { id: true; name: true; email: true; role: true } };
    items: {
      include: {
        permintaanItem: { include: { item: true } };
        item: true;
      };
    };
  };
}>;

export type StokDivisiMaterial = {
  itemId: number | null;
  key: string;
  nama: string;
  jenis: string | null;
  satuan: string | null;
  diterima: number;
  masuk: number;
  dipakai: number;
  sisa: number;
};

export type StokDivisi = {
  divisiId: number;
  divisiNama: string;
  materials: StokDivisiMaterial[];
};

export class PemakaianError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PemakaianError";
    this.code = code;
  }
}

export const PERMINTAAN_TIDAK_DITEMUKAN = "PERMINTAAN_TIDAK_DITEMUKAN";
export const DIVISI_TIDAK_DITEMUKAN = "DIVISI_TIDAK_DITEMUKAN";
export const ITEM_PERMINTAAN_TIDAK_VALID = "ITEM_PERMINTAAN_TIDAK_VALID";
export const PEMAKAIAN_DUPLIKAT_ITEM = "PEMAKAIAN_DUPLIKAT_ITEM";
export const JUMLAH_PEMAKAIAN_INVALID = "JUMLAH_PEMAKAIAN_INVALID";
export const PEMAKAIAN_TERKUNCI = "PEMAKAIAN_TERKUNCI";
export const PEMAKAIAN_DIPAKAI_PRODUKSI = "PEMAKAIAN_DIPAKAI_PRODUKSI";
export const PEMAKAIAN_SUMBER_INTERNAL = "PEMAKAIAN_SUMBER_INTERNAL";
export const PEMAKAIAN_SUDAH_TRANSFER = "PEMAKAIAN_SUDAH_TRANSFER";
export const TRANSISI_STATUS_INVALID = "TRANSISI_STATUS_INVALID";

function tanggalPrefix(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `PM-${yyyy}${mm}${dd}-`;
}

async function generateNomor(tx: PrismaTransactionClient, date: Date): Promise<string> {
  const prefix = tanggalPrefix(date);
  const terakhir = await tx.pemakaianMaterial.findFirst({
    where: { nomor: { startsWith: prefix } },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });
  const urut = terakhir ? Number(terakhir.nomor.slice(prefix.length)) + 1 : 1;
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

function effectiveTanggal(input: PemakaianInput | null, existing?: PemakaianRecord | null): Date {
  const d = input?.tanggal;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  return new Date();
}

// Stok divisi untuk satu material = sisa pada pencatatan terakhir divisi itu.
// Fallback ke jumlah disetujui kalau divisi belum pernah mencatat material ini.
async function resolveSisaSebelumnya(
  tx: PrismaTransactionClient,
  divisiId: number,
  permItem: {
    itemId: number | null;
    nama: string;
    jumlah: number;
    jumlahDisetujui: number | null;
  },
  excludePemakaianId?: number,
): Promise<number> {
  const where: Prisma.PemakaianMaterialItemWhereInput = {
    pemakaian: {
      divisiId,
      ...(excludePemakaianId ? { id: { not: excludePemakaianId } } : {}),
    },
  };
  if (permItem.itemId !== null) where.itemId = permItem.itemId;
  else where.permintaanItem = { nama: permItem.nama };

  const latest = await tx.pemakaianMaterialItem.findFirst({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { jumlahSisa: true },
  });
  return latest ? Number(latest.jumlahSisa) : permItem.jumlahDisetujui ?? permItem.jumlah;
}

async function validateAndPrepare(
  tx: PrismaTransactionClient,
  input: PemakaianInput,
  excludePemakaianId?: number,
) {
  const permintaan = await tx.permintaanBarang.findUnique({
    where: { id: input.permintaanId },
  });
  if (!permintaan) throw new PemakaianError(PERMINTAAN_TIDAK_DITEMUKAN, "Permintaan barang tidak ditemukan");
  if (permintaan.approval !== "DISETUJUI") {
    throw new PemakaianError(ITEM_PERMINTAAN_TIDAK_VALID, "Permintaan barang harus sudah disetujui");
  }
  const divisi = await tx.divisi.findUnique({ where: { id: input.divisiId } });
  if (!divisi) throw new PemakaianError(DIVISI_TIDAK_DITEMUKAN, "Divisi tidak ditemukan");
  if (permintaan.departemen.trim().toLowerCase() !== divisi.nama.trim().toLowerCase()) {
    throw new PemakaianError(ITEM_PERMINTAAN_TIDAK_VALID, "Permintaan barang tidak sesuai divisi");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new PemakaianError(JUMLAH_PEMAKAIAN_INVALID, "Minimal satu item pemakaian diperlukan");
  }
  const seen = new Set<number>();
  const rows: Prisma.PemakaianMaterialItemUncheckedCreateWithoutPemakaianInput[] = [];
  for (const item of input.items) {
    if (seen.has(item.permintaanBarangItemId)) {
      throw new PemakaianError(PEMAKAIAN_DUPLIKAT_ITEM, "Item permintaan duplikat dalam satu transaksi");
    }
    seen.add(item.permintaanBarangItemId);
    const permItem = await tx.permintaanBarangItem.findUnique({
      where: { id: item.permintaanBarangItemId },
      include: { item: true, permintaan: true },
    });
    if (!permItem) throw new PemakaianError(ITEM_PERMINTAAN_TIDAK_VALID, "Item permintaan tidak valid untuk transaksi ini");
    if (permItem.permintaan.approval !== "DISETUJUI") {
      throw new PemakaianError(ITEM_PERMINTAAN_TIDAK_VALID, "Item permintaan harus berasal dari permintaan yang disetujui");
    }
    if (permItem.permintaan.departemen.trim().toLowerCase() !== divisi.nama.trim().toLowerCase()) {
      throw new PemakaianError(ITEM_PERMINTAAN_TIDAK_VALID, "Item permintaan tidak sesuai divisi");
    }
    const jumlahSisa = Number(item.jumlahSisa);
    if (!Number.isFinite(jumlahSisa) || jumlahSisa < 0) {
      throw new PemakaianError(JUMLAH_PEMAKAIAN_INVALID, "Jumlah sisa tidak boleh negatif");
    }
    const jumlahDiterima = await resolveSisaSebelumnya(tx, input.divisiId, permItem, excludePemakaianId);
    if (jumlahSisa > jumlahDiterima) {
      throw new PemakaianError(JUMLAH_PEMAKAIAN_INVALID, "Jumlah sisa tidak boleh melebihi stok divisi saat ini");
    }
    const satuan =
      item.satuan !== undefined && item.satuan !== null && String(item.satuan).trim() !== ""
        ? String(item.satuan).trim()
        : permItem.satuan ?? permItem.item?.unit ?? null;
    rows.push({
      permintaanBarangItemId: item.permintaanBarangItemId,
      itemId: permItem.itemId ?? null,
      jumlahDiterima,
      jumlahDipakai: Math.max(jumlahDiterima - jumlahSisa, 0),
      jumlahSisa,
      satuan,
      keteranganSisa: item.keteranganSisa ?? null,
    });
  }
  return rows;
}

async function resolveReceiptSourceLocation(
  tx: PrismaTransactionClient,
  itemId: number,
  preferredLocationId: number | null,
): Promise<number> {
  if (preferredLocationId !== null) {
    const preferred = await tx.stockBalance.aggregate({
      where: { itemId, locationId: preferredLocationId, quantity: { gt: 0 } },
      _sum: { quantity: true },
    });
    if (Number(preferred._sum.quantity ?? 0) > 0) return preferredLocationId;
  }
  const rows = await tx.stockBalance.groupBy({
    by: ["locationId"],
    where: { itemId, quantity: { gt: 0 }, location: { type: "WAREHOUSE", isActive: true } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
  });
  const source = rows.find((row) => Number(row._sum.quantity ?? 0) > 0);
  if (!source) {
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      `Tidak ada saldo gudang untuk item ${itemId}; penerimaan divisi tidak dapat diposting`,
    );
  }
  return source.locationId;
}

async function createInTx(tx: PrismaTransactionClient, input: PemakaianInput, userId: number | null): Promise<PemakaianRecord> {
  const tanggal = awalHariBisnis(effectiveTanggal(input));
  const rows = await validateAndPrepare(tx, input);
  const nomor = await generateNomor(tx, tanggal);
  const created = await tx.pemakaianMaterial.create({
    data: {
      nomor,
      permintaanId: input.permintaanId,
      divisiId: input.divisiId,
      tanggal,
      userId,
      keterangan: input.keterangan ?? null,
      items: { create: rows },
    },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          itemId: true,
          jumlahDiterima: true,
          jumlahDipakai: true,
          item: { select: { defaultInventoryLocationId: true } },
        },
      },
    },
  });

  // Penerimaan fisik ke divisi WAJIB tercermin di ledger lokasi.
  //
  // Semantik dokumen ini: `jumlahDiterima` adalah SALDO SEBELUM pemakaian
  // (saldo berjalan), bukan kuantitas yang baru masuk. Karena itu:
  // - penerimaan (IN) hanya diposting pada catatan PERTAMA per (divisi,item),
  //   yang memang mewakili material yang baru diterima divisi;
  // - pemakaian manual (`jumlahDipakai`) diposting sebagai OUT pada lokasi
  //   divisi. Nilai ini sudah relatif terhadap saldo sebelumnya (yang telah
  //   memperhitungkan konsumsi produksi), sehingga tidak dihitung dua kali.
  const divisionLocation = await ensureDivisionInventoryLocation(tx, input.divisiId);
  for (const lot of created.items) {
    if (lot.itemId === null) continue;
    const diterima = Number(lot.jumlahDiterima);
    const dipakai = Number(lot.jumlahDipakai);
    const priorRecords = await tx.pemakaianMaterialItem.count({
      where: {
        itemId: lot.itemId,
        id: { not: lot.id },
        pemakaian: { divisiId: input.divisiId },
      },
    });

    if (priorRecords === 0 && diterima > 0) {
      const sourceLocationId = await resolveReceiptSourceLocation(
        tx,
        lot.itemId,
        lot.item?.defaultInventoryLocationId ?? null,
      );
      await receiveItemToDivision(tx, {
        itemId: lot.itemId,
        fromLocationId: sourceLocationId,
        toLocationId: divisionLocation.id,
        pemakaianMaterialItemId: lot.id,
        quantity: diterima,
        idempotencyKey: `pemakaian-receipt:${lot.id}`,
        sourceType: "PEMAKAIAN_MATERIAL",
        sourceId: String(created.id),
        reason: `Penerimaan material divisi ${nomor}`,
        userId,
        occurredAt: tanggal,
      });
    }

    if (dipakai > 0) {
      await postInventoryMovementInTransaction(tx, {
        itemId: lot.itemId,
        pemakaianMaterialItemId: lot.id,
        fromLocationId: divisionLocation.id,
        type: "ADJUSTMENT",
        quantity: dipakai,
        idempotencyKey: `pemakaian-usage:${lot.id}`,
        sourceType: "PEMAKAIAN_MATERIAL_USAGE",
        sourceId: String(created.id),
        reason: `Pemakaian manual material divisi ${nomor}`,
        userId,
        occurredAt: tanggal,
      });
    }
  }

  return tx.pemakaianMaterial.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      permintaan: { include: { items: { include: { item: true } } } },
      divisi: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      items: { include: { permintaanItem: { include: { item: true } }, item: true } },
    },
  });
}

export async function createPemakaian(input: PemakaianInput, userId: number | null = null): Promise<PemakaianRecord> {
  try {
    return await prisma.$transaction((tx) => createInTx(tx, input, userId));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return prisma.$transaction((tx) => createInTx(tx, input, userId));
  }
}

export async function listPemakaian(params: {
  page: number;
  limit: number;
  permintaanId?: number;
  divisiId?: number;
  dari?: Date;
  sampai?: Date;
}): Promise<{ data: PemakaianRecord[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const where: Prisma.PemakaianMaterialWhereInput = {
    sumber: SumberPemakaianMaterial.PERMINTAAN_BARANG,
  };
  if (params.permintaanId !== undefined) where.permintaanId = params.permintaanId;
  if (params.divisiId !== undefined) where.divisiId = params.divisiId;
  if (params.dari || params.sampai) {
    where.tanggal = {};
    if (params.dari) where.tanggal.gte = startOfDay(params.dari);
    if (params.sampai) where.tanggal.lt = startOfDay(addDays(params.sampai, 1));
  }
  const include = {
    permintaan: { include: { items: { include: { item: true } } } },
    divisi: true,
    user: { select: { id: true, name: true, email: true, role: true } },
    items: { include: { permintaanItem: { include: { item: true } }, item: true } },
  } as const;
  const [total, data] = await Promise.all([
    prisma.pemakaianMaterial.count({ where }),
    prisma.pemakaianMaterial.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);
  return { data, meta: { page: params.page, limit: params.limit, total, totalPages: Math.max(1, Math.ceil(total / params.limit)) } };
}

export async function getPemakaianById(id: number): Promise<PemakaianRecord | null> {
  return prisma.pemakaianMaterial.findUnique({
    where: { id },
    include: {
      permintaan: { include: { items: { include: { item: true } } } },
      divisi: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      items: { include: { permintaanItem: { include: { item: true } }, item: true } },
    },
  });
}

// Stok divisi = saldo WIP yang sama dengan endpoint /hasil-produksi-harian/wip.
// diterima = saldo awal periode, dipakai = keluar periode, sisa = saldo akhir.
export async function getStokPerDivisi(
  params: { dari?: Date; sampai?: Date } = {},
): Promise<StokDivisi[]> {
  const rows = await getWipRows({ dari: params.dari, sampai: params.sampai });
  const byDivisi = new Map<number, StokDivisi>();

  for (const row of rows) {
    if (row.divisiId === null) continue;
    let group = byDivisi.get(row.divisiId);
    if (!group) {
      group = {
        divisiId: row.divisiId,
        divisiNama: row.divisiNama ?? "",
        materials: [],
      };
      byDivisi.set(row.divisiId, group);
    }
    group.materials.push({
      itemId: row.itemId,
      key: `item:${row.itemId}`,
      nama: row.nama,
      jenis: row.jenis,
      satuan: row.unit,
      diterima: row.saldoAwal,
      masuk: row.masuk,
      dipakai: row.keluar,
      sisa: row.saldoAkhir,
    });
  }

  return [...byDivisi.values()]
    .map((group) => ({
      ...group,
      materials: group.materials.sort((a, b) => a.nama.localeCompare(b.nama)),
    }))
    .sort((a, b) => a.divisiNama.localeCompare(b.divisiNama));
}

async function pastikanBelumDipakaiProduksi(
  tx: PrismaTransactionClient,
  pemakaianId: number,
  aksi: string,
): Promise<void> {
  const linked = await tx.pemakaianMaterialItem.findFirst({
    where: { pemakaianId, hasilProduksiPemakaian: { some: {} } },
    select: { id: true },
  });
  if (linked) {
    throw new PemakaianError(
      PEMAKAIAN_DIPAKAI_PRODUKSI,
      `Pemakaian material sudah dipakai produksi dan tidak bisa ${aksi}`,
    );
  }
}

async function pastikanPemakaianManual(
  tx: PrismaTransactionClient,
  pemakaianId: number,
  aksi: string,
): Promise<void> {
  const existing = await tx.pemakaianMaterial.findUnique({
    where: { id: pemakaianId },
    select: { sumber: true },
  });
  if (existing && existing.sumber !== SumberPemakaianMaterial.PERMINTAAN_BARANG) {
    throw new PemakaianError(
      PEMAKAIAN_SUMBER_INTERNAL,
      `Pemakaian material internal WIP tidak bisa ${aksi} dari halaman gudang`,
    );
  }

  const alokasi = await tx.wipTransferAlokasi.findFirst({
    where: { pemakaianMaterialItem: { pemakaianId } },
    select: { id: true },
  });
  if (alokasi) {
    throw new PemakaianError(
      PEMAKAIAN_SUDAH_TRANSFER,
      `Pemakaian material sudah dipakai transfer WIP dan tidak bisa ${aksi}`,
    );
  }
}

async function pastikanBelumPunyaLedger(
  tx: PrismaTransactionClient,
  pemakaianId: number,
  aksi: string,
): Promise<void> {
  const movement = await tx.inventoryMovement.findFirst({
    where: { pemakaianMaterialItem: { pemakaianId } },
    select: { id: true },
  });
  if (movement) {
    throw new PemakaianError(
      PEMAKAIAN_TERKUNCI,
      `Pemakaian material sudah tercatat di ledger inventory dan tidak bisa ${aksi}; gunakan koreksi/reversal`,
    );
  }
}

export async function updatePemakaian(id: number, input: PemakaianInput, userId: number | null = null): Promise<PemakaianRecord | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pemakaianMaterial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    await pastikanPemakaianManual(tx, id, "diubah");
    await pastikanBelumDipakaiProduksi(tx, id, "diubah");
    await pastikanBelumPunyaLedger(tx, id, "diubah");
    const tanggal = effectiveTanggal(input);
    const rows = await validateAndPrepare(tx, input, id);
    return tx.pemakaianMaterial.update({
      where: { id },
      data: {
        permintaanId: input.permintaanId,
        divisiId: input.divisiId,
        tanggal,
        keterangan: input.keterangan ?? null,
        items: { deleteMany: {}, create: rows },
      },
      include: {
        permintaan: { include: { items: { include: { item: true } } } },
        divisi: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { permintaanItem: { include: { item: true } }, item: true } },
      },
    });
  });
}

export async function deletePemakaian(id: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pemakaianMaterial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    await pastikanPemakaianManual(tx, id, "dihapus");
    await pastikanBelumDipakaiProduksi(tx, id, "dihapus");
    await pastikanBelumPunyaLedger(tx, id, "dihapus");
    await tx.pemakaianMaterial.delete({ where: { id } });
    return true;
  });
}
