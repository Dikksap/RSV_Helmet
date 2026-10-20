import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

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

function materialKey(itemId: number | null, nama: string, satuan: string | null): string {
  return itemId !== null ? `item:${itemId}` : `name:${nama.trim().toLowerCase()}|${satuan ?? ""}`;
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

async function createInTx(tx: PrismaTransactionClient, input: PemakaianInput, userId: number | null): Promise<PemakaianRecord> {
  const tanggal = effectiveTanggal(input);
  const rows = await validateAndPrepare(tx, input);
  const nomor = await generateNomor(tx, tanggal);
  return tx.pemakaianMaterial.create({
    data: {
      nomor,
      permintaanId: input.permintaanId,
      divisiId: input.divisiId,
      tanggal,
      userId,
      keterangan: input.keterangan ?? null,
      items: { create: rows },
    },
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
  const where: Prisma.PemakaianMaterialWhereInput = {};
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

// Stok saat ini per divisi = sisa pada pencatatan terbaru tiap material divisi.
// Kalau rentang tanggal diisi (mutasi periode): diterima = stok awal periode,
// dipakai = total pemakaian dalam periode, sisa = saldo catatan terakhir dalam periode.
// Material yang tidak punya catatan di periode itu tidak muncul.
// ponytail: memuat semua baris PemakaianMaterialItem lalu dedupe di memori.
// Pindahkan ke agregasi SQL kalau volume data sudah besar.
export async function getStokPerDivisi(
  params: { dari?: Date; sampai?: Date } = {},
): Promise<StokDivisi[]> {
  const berperiode = Boolean(params.dari || params.sampai);
  const where: Prisma.PemakaianMaterialItemWhereInput = {};
  if (berperiode) {
    where.pemakaian = {
      tanggal: {
        ...(params.dari ? { gte: startOfDay(params.dari) } : {}),
        ...(params.sampai ? { lt: startOfDay(addDays(params.sampai, 1)) } : {}),
      },
    };
  }

  const rows = await prisma.pemakaianMaterialItem.findMany({
    where,
    orderBy: berperiode
      ? [{ pemakaian: { tanggal: "asc" } }, { id: "asc" }]
      : [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      pemakaian: { include: { divisi: true } },
      permintaanItem: { include: { item: true } },
      item: true,
    },
  });

  const byDivisi = new Map<
    number,
    {
      divisiId: number;
      divisiNama: string;
      byKey: Map<string, StokDivisiMaterial>;
      materials: StokDivisiMaterial[];
    }
  >();

  for (const row of rows) {
    const divisi = row.pemakaian.divisi;
    const nama = row.permintaanItem?.nama ?? row.item?.nama ?? row.item?.kode ?? "Material";
    const satuan = row.satuan ?? row.permintaanItem?.satuan ?? row.item?.unit ?? null;
    const key = materialKey(row.itemId, nama, satuan);

    let group = byDivisi.get(divisi.id);
    if (!group) {
      group = { divisiId: divisi.id, divisiNama: divisi.nama, byKey: new Map(), materials: [] };
      byDivisi.set(divisi.id, group);
    }

    const existing = group.byKey.get(key);
    if (existing) {
      // Tanpa rentang, catatan terbaru sudah jadi yang pertama dilihat.
      if (!berperiode) continue;
      existing.dipakai += Number(row.jumlahDipakai) || 0;
      existing.sisa = Number(row.jumlahSisa) || 0;
      continue;
    }

    const material: StokDivisiMaterial = {
      itemId: row.itemId,
      key,
      nama,
      jenis: row.permintaanItem?.item?.jenis ?? row.item?.jenis ?? null,
      satuan,
      diterima: Number(row.jumlahDiterima) || 0,
      dipakai: Number(row.jumlahDipakai) || 0,
      sisa: Number(row.jumlahSisa) || 0,
    };
    group.byKey.set(key, material);
    group.materials.push(material);
  }

  return [...byDivisi.values()]
    .map((group) => ({
      divisiId: group.divisiId,
      divisiNama: group.divisiNama,
      materials: group.materials.sort((a, b) => a.nama.localeCompare(b.nama)),
    }))
    .sort((a, b) => a.divisiNama.localeCompare(b.divisiNama));
}

export async function updatePemakaian(id: number, input: PemakaianInput, userId: number | null = null): Promise<PemakaianRecord | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pemakaianMaterial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
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
  const existing = await prisma.pemakaianMaterial.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.pemakaianMaterial.delete({ where: { id } });
  return true;
}
