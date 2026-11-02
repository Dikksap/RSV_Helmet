import { randomUUID } from "node:crypto";
import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  consumeItemAtLocation,
  getItemStockAtLocation,
  InventoryError,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";
import { lockItem } from "../stokItem/stokItem.js";

export type ProduksiBahanInput = {
  itemId: number;
  sumberLocationId: number;
};

export type ProduksiInput = {
  tanggalProduksi?: Date | null;
  divisiId: number;
  outputItemId: number;
  jumlah: number;
  tujuanLocationId: number;
  keterangan?: string | null;
  bahan: ProduksiBahanInput[];
};

export type PenerimaanInput = {
  tanggal?: Date | null;
  itemId: number;
  locationId: number;
  jumlah: number;
  keterangan?: string | null;
  idempotencyKey?: string | null;
};

export class ProduksiHarianError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProduksiHarianError";
    this.code = code;
  }
}

const itemSelect = {
  id: true,
  kode: true,
  nama: true,
  unit: true,
  jenis: true,
  stok: true,
  defaultInventoryLocationId: true,
} as const;

const detailInclude = {
  divisi: { select: { id: true, nama: true } },
  tujuanLocation: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      gudang: { select: { id: true, kode: true, name: true } },
    },
  },
  user: { select: { id: true, name: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      item: { select: itemSelect },
      sumberLocation: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          gudang: { select: { id: true, kode: true, name: true } },
          divisi: { select: { id: true, nama: true } },
        },
      },
    },
  },
} satisfies Prisma.ProduksiHarianInclude;

export type ProduksiHarianDetail = Prisma.ProduksiHarianGetPayload<{
  include: typeof detailInclude;
}>;

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function validQuantity(value: number) {
  return Number.isFinite(value) && value > 0 && Number.isSafeInteger(value * 1_000_000);
}

function tanggalPrefix(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `PH-${yyyy}${mm}${dd}-`;
}

async function generateNomor(tx: PrismaTransactionClient, date: Date): Promise<string> {
  const prefix = tanggalPrefix(date);
  const terakhir = await tx.produksiHarian.findFirst({
    where: { nomor: { startsWith: prefix } },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });
  const urut = terakhir ? Number(terakhir.nomor.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(urut).padStart(4, "0")}`;
}

type BomLine = {
  itemId: number;
  kode: string;
  nama: string;
  jenis: string | null;
  jumlah: number;
  unit: string | null;
};

async function resolveActiveBom(tx: PrismaTransactionClient, subassemblyId: number) {
  const bom = await tx.bom.findFirst({
    where: { subassemblyId, isActive: true },
    orderBy: { id: "desc" },
    include: {
      items: {
        orderBy: [{ level: "asc" }, { urutan: "asc" }, { id: "asc" }],
        include: {
          item: { select: { id: true, unit: true } },
          subassembly: { select: { id: true } },
        },
      },
    },
  });
  if (!bom) {
    throw new ProduksiHarianError(
      "BOM_TIDAK_DITEMUKAN",
      `BOM aktif untuk subassembly ${subassemblyId} tidak ditemukan`,
    );
  }
  return bom;
}

async function flattenBom(
  tx: PrismaTransactionClient,
  outputItemId: number,
  outputQuantity: number,
): Promise<BomLine[]> {
  const subassembly = await tx.subassembly.findUnique({
    where: { itemId: outputItemId },
    select: { id: true, nama: true },
  });
  if (!subassembly) {
    throw new ProduksiHarianError(
      "BOM_TIDAK_DITEMUKAN",
      "Produk hasil belum punya subassembly/BOM. BOM product variant tidak dipakai.",
    );
  }

  const totals = new Map<number, { itemId: number; jumlah: number; unit: string | null }>();

  const walk = async (subassemblyId: number, factor: number) => {
    const bom = await resolveActiveBom(tx, subassemblyId);
    for (const component of bom.items) {
      const scrap = component.scrapPercent ? Number(component.scrapPercent) / 100 : 0;
      const qty = round6(Number(component.quantity) * factor * (1 + scrap));
      if (qty <= 0) continue;
      if (component.itemId != null) {
        const current = totals.get(component.itemId);
        totals.set(component.itemId, {
          itemId: component.itemId,
          jumlah: round6((current?.jumlah ?? 0) + qty),
          unit: component.unit ?? component.item?.unit ?? current?.unit ?? null,
        });
        continue;
      }
      if (component.subassemblyId != null) {
        await walk(component.subassemblyId, qty);
        continue;
      }
      throw new ProduksiHarianError(
        "BOM_TIDAK_LENGKAP",
        `Komponen BOM ${bom.nama} tidak punya item atau subassembly`,
      );
    }
  };

  await walk(subassembly.id, outputQuantity);

  const itemIds = [...totals.keys()];
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, kode: true, nama: true, unit: true, jenis: true },
  });
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return [...totals.values()]
    .map((line) => {
      const item = itemMap.get(line.itemId);
      if (!item) {
        throw new ProduksiHarianError("ITEM_TIDAK_DITEMUKAN", `Item ${line.itemId} tidak ditemukan`);
      }
      return {
        itemId: line.itemId,
        kode: item.kode,
        nama: item.nama,
        unit: line.unit ?? item.unit,
        jenis: item.jenis,
        jumlah: line.jumlah,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

async function assertWarehouseAllows(
  tx: PrismaTransactionClient,
  locationId: number,
  itemJenis: string | null,
) {
  const location = await tx.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { id: true, type: true, isActive: true, gudangId: true, divisiId: true },
  });
  if (!location?.isActive) {
    throw new ProduksiHarianError("LOKASI_TIDAK_DITEMUKAN", "Lokasi tidak ditemukan atau tidak aktif");
  }
  if (location.type !== "WAREHOUSE" || location.gudangId == null) return location;
  if (!itemJenis) return location;
  const gudangId = location.gudangId;
  const total = await tx.gudangJenisItem.count({ where: { gudangId } });
  if (total === 0) return location;
  const allowed = await tx.gudangJenisItem.count({ where: { gudangId, jenis: itemJenis } });
  if (allowed === 0) {
    throw new ProduksiHarianError(
      "GUDANG_JENIS_TIDAK_DIIZINKAN",
      `Gudang ini tidak diizinkan menyimpan item jenis ${itemJenis}`,
    );
  }
  return location;
}

export async function getProduksiOptions() {
  const [outputs, divisions, warehouses] = await Promise.all([
    prisma.subassembly.findMany({
      where: {
        itemId: { not: null },
        isActive: true,
        bomAsOutput: { some: { isActive: true } },
      },
      select: {
        id: true,
        kode: true,
        nama: true,
        item: { select: { id: true, kode: true, nama: true, unit: true, jenis: true, stok: true } },
        bomAsOutput: {
          where: { isActive: true },
          orderBy: { id: "desc" },
          take: 1,
          select: { id: true, nama: true, version: true },
        },
      },
      orderBy: { nama: "asc" },
    }),
    prisma.divisi.findMany({ select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
    prisma.inventoryLocation.findMany({
      where: { type: "WAREHOUSE", isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        gudang: { select: { id: true, kode: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    outputs: outputs
      .filter((row) => row.item !== null)
      .map((row) => ({
        subassemblyId: row.id,
        subassemblyKode: row.kode,
        subassemblyNama: row.nama,
        item: row.item!,
        bom: row.bomAsOutput[0] ?? null,
      })),
    divisions,
    warehouses,
  };
}

export async function listLokasi() {
  return prisma.inventoryLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      gudang: { select: { id: true, kode: true, name: true } },
      divisi: { select: { id: true, nama: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function listStokGudang() {
  const [warehouses, balances] = await Promise.all([
    prisma.inventoryLocation.findMany({
      where: { type: "WAREHOUSE", isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        gudang: { select: { id: true, kode: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockBalance.findMany({
      where: {
        itemId: { not: null },
        quantity: { not: 0 },
        location: { type: "WAREHOUSE", isActive: true },
      },
      select: {
        itemId: true,
        locationId: true,
        quantity: true,
        item: { select: { kode: true, nama: true, unit: true, jenis: true, isActive: true } },
      },
    }),
  ]);
  const perLocation = new Map<number, Map<number, {
    itemId: number;
    kode: string;
    nama: string;
    unit: string;
    jenis: string | null;
    isActive: boolean;
    quantity: number;
  }>>();
  for (const balance of balances) {
    if (balance.itemId === null || balance.item === null) continue;
    const items = perLocation.get(balance.locationId) ?? new Map();
    const existing = items.get(balance.itemId);
    items.set(balance.itemId, {
      itemId: balance.itemId,
      ...balance.item,
      quantity: (existing?.quantity ?? 0) + Number(balance.quantity),
    });
    perLocation.set(balance.locationId, items);
  }
  return warehouses.map((location) => ({
    location,
    items: [...(perLocation.get(location.id)?.values() ?? [])]
      .filter((item) => item.quantity !== 0)
      .sort((a, b) => a.kode.localeCompare(b.kode)),
  }));
}

export async function getBomPreview(
  outputItemId: number,
  jumlah: number,
  divisiId: number | null,
) {
  if (!Number.isInteger(outputItemId) || outputItemId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "outputItemId harus angka bulat positif");
  }
  if (!validQuantity(jumlah)) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "jumlah harus lebih dari 0");
  }
  const output = await prisma.item.findUnique({
    where: { id: outputItemId },
    select: itemSelect,
  });
  if (!output) throw new ProduksiHarianError("ITEM_TIDAK_DITEMUKAN", "Item hasil tidak ditemukan");

  const lines = await prisma.$transaction((tx) => flattenBom(tx, outputItemId, jumlah));
  const itemIds = lines.map((line) => line.itemId);
  const balances = await prisma.stockBalance.findMany({
    where: { itemId: { in: itemIds }, batchId: null, quantity: { not: 0 } },
    select: {
      itemId: true,
      locationId: true,
      quantity: true,
      location: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          gudang: { select: { id: true, kode: true, name: true } },
          divisi: { select: { id: true, nama: true } },
        },
      },
    },
  });
  const byItem = new Map<number, typeof balances>();
  for (const balance of balances) {
    if (balance.itemId == null) continue;
    const rows = byItem.get(balance.itemId) ?? [];
    rows.push(balance);
    byItem.set(balance.itemId, rows);
  }

  const divisionLocationId = divisiId
    ? (await prisma.inventoryLocation.findUnique({ where: { divisiId }, select: { id: true } }))?.id ?? null
    : null;

  return {
    output,
    jumlah,
    divisionLocationId,
    lines: lines.map((line) => ({
      ...line,
      stok: (byItem.get(line.itemId) ?? [])
        .map((row) => ({
          locationId: row.locationId,
          code: row.location.code,
          name: row.location.name,
          type: row.location.type,
          gudang: row.location.gudang,
          divisi: row.location.divisi,
          quantity: Number(row.quantity),
        }))
        .sort((a, b) => b.quantity - a.quantity),
    })),
  };
}

export async function listProduksi(filter: {
  page: number;
  limit: number;
  divisiId?: number;
  dari?: Date;
  sampai?: Date;
}) {
  const where: Prisma.ProduksiHarianWhereInput = {};
  if (filter.divisiId) where.divisiId = filter.divisiId;
  if (filter.dari || filter.sampai) {
    where.tanggalProduksi = {};
    if (filter.dari) where.tanggalProduksi.gte = filter.dari;
    if (filter.sampai) where.tanggalProduksi.lt = new Date(filter.sampai.getTime() + 86_400_000);
  }
  const [total, data] = await Promise.all([
    prisma.produksiHarian.count({ where }),
    prisma.produksiHarian.findMany({
      where,
      include: detailInclude,
      orderBy: [{ tanggalProduksi: "desc" }, { id: "desc" }],
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
  ]);
  return {
    data,
    meta: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function getProduksiById(id: number) {
  return prisma.produksiHarian.findUnique({ where: { id }, include: detailInclude });
}

export async function createProduksi(input: ProduksiInput, userId: number | null) {
  if (!Number.isInteger(input.divisiId) || input.divisiId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "divisiId harus angka bulat positif");
  }
  if (!Number.isInteger(input.outputItemId) || input.outputItemId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "outputItemId harus angka bulat positif");
  }
  if (!Number.isInteger(input.tujuanLocationId) || input.tujuanLocationId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "tujuanLocationId harus angka bulat positif");
  }
  if (!validQuantity(input.jumlah)) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "jumlah hasil harus lebih dari 0");
  }
  if (!Array.isArray(input.bahan) || input.bahan.length === 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "Daftar bahan wajib diisi");
  }
  if (input.bahan.some((row) => !Number.isInteger(row.itemId) || row.itemId <= 0 || !Number.isInteger(row.sumberLocationId) || row.sumberLocationId <= 0)) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "bahan[].itemId dan sumberLocationId harus angka bulat positif");
  }

  return prisma.$transaction(async (tx) => {
    const divisi = await tx.divisi.findUnique({
      where: { id: input.divisiId },
      select: { id: true, nama: true },
    });
    if (!divisi) throw new ProduksiHarianError("DIVISI_TIDAK_DITEMUKAN", "Divisi tidak ditemukan");

    const output = await tx.item.findUnique({
      where: { id: input.outputItemId },
      select: { ...itemSelect, isActive: true },
    });
    if (!output?.isActive) {
      throw new ProduksiHarianError("ITEM_TIDAK_DITEMUKAN", "Item hasil tidak ditemukan atau tidak aktif");
    }

    const destination = await assertWarehouseAllows(tx, input.tujuanLocationId, output.jenis);
    if (destination.type !== "WAREHOUSE") {
      throw new ProduksiHarianError("TUJUAN_BUKAN_GUDANG", "Tujuan output produksi harus gudang");
    }

    const bomLines = await flattenBom(tx, input.outputItemId, input.jumlah);
    const sourceByItem = new Map<number, number>();
    for (const row of input.bahan) {
      if (sourceByItem.has(row.itemId)) {
        throw new ProduksiHarianError("INPUT_TIDAK_VALID", `Bahan item ${row.itemId} duplikat`);
      }
      sourceByItem.set(row.itemId, row.sumberLocationId);
    }

    for (const line of bomLines) {
      const sourceId = sourceByItem.get(line.itemId);
      if (!sourceId) {
        throw new ProduksiHarianError(
          "SUMBER_BAHAN_WAJIB",
          `Lokasi sumber bahan ${line.kode} - ${line.nama} wajib dipilih`,
        );
      }
      const source = await assertWarehouseAllows(tx, sourceId, line.jenis);
      if (source.type === "DIVISION" && source.divisiId !== input.divisiId) {
        throw new ProduksiHarianError(
          "SUMBER_DIVISI_TIDAK_COCOK",
          `Bahan ${line.kode} hanya boleh diambil dari divisi produksi atau gudang`,
        );
      }
      await lockItem(tx, line.itemId);
      const tersedia = await getItemStockAtLocation(tx, line.itemId, sourceId);
      if (tersedia + 0.000001 < line.jumlah) {
        throw new ProduksiHarianError(
          "STOK_TIDAK_CUKUP",
          `Stok ${line.kode} di lokasi sumber tidak cukup (tersedia ${tersedia}, butuh ${line.jumlah})`,
        );
      }
    }

    await lockItem(tx, output.id);
    const tanggal = input.tanggalProduksi ?? new Date();
    const nomor = await generateNomor(tx, tanggal);
    const header = await tx.produksiHarian.create({
      data: {
        nomor,
        tanggalProduksi: tanggal,
        divisiId: input.divisiId,
        tujuanLocationId: input.tujuanLocationId,
        userId,
        keterangan: input.keterangan?.trim() || null,
        items: {
          create: [
            ...bomLines.map((line) => ({
              itemId: line.itemId,
              tipe: "BAHAN" as const,
              jumlah: line.jumlah,
              sumberLocationId: sourceByItem.get(line.itemId),
            })),
            {
              itemId: output.id,
              tipe: "HASIL" as const,
              jumlah: input.jumlah,
            },
          ],
        },
      },
      select: { id: true, nomor: true },
    });

    for (const line of bomLines) {
      const sourceId = sourceByItem.get(line.itemId)!;
      await consumeItemAtLocation(tx, {
        itemId: line.itemId,
        locationId: sourceId,
        quantity: line.jumlah,
        idempotencyKey: `produksi-harian:${header.id}:bahan:${line.itemId}`,
        sourceType: "PRODUKSI_HARIAN",
        sourceId: String(header.id),
        reason: `Bahan produksi ${header.nomor}`,
        userId,
        occurredAt: tanggal,
        produksiHarianId: header.id,
      });
    }

    await postInventoryMovementInTransaction(tx, {
      itemId: output.id,
      toLocationId: input.tujuanLocationId,
      produksiHarianId: header.id,
      type: "PRODUCTION",
      quantity: input.jumlah,
      idempotencyKey: `produksi-harian:${header.id}:hasil`,
      sourceType: "PRODUKSI_HARIAN",
      sourceId: String(header.id),
      reason: `Hasil produksi ${header.nomor}`,
      userId,
      occurredAt: tanggal,
      syncItemStok: true,
    });

    return tx.produksiHarian.findUniqueOrThrow({
      where: { id: header.id },
      include: detailInclude,
    });
  });
}

export async function createPenerimaan(input: PenerimaanInput, userId: number | null) {
  if (!Number.isInteger(input.itemId) || input.itemId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "itemId harus angka bulat positif");
  }
  if (!Number.isInteger(input.locationId) || input.locationId <= 0) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "locationId harus angka bulat positif");
  }
  if (!validQuantity(input.jumlah)) {
    throw new ProduksiHarianError("INPUT_TIDAK_VALID", "jumlah masuk harus lebih dari 0");
  }

  return prisma.$transaction(async (tx) => {
    await lockItem(tx, input.itemId);
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true, kode: true, nama: true, unit: true, jenis: true, isActive: true },
    });
    if (!item?.isActive) {
      throw new ProduksiHarianError("ITEM_TIDAK_DITEMUKAN", "Item tidak ditemukan atau tidak aktif");
    }
    await assertWarehouseAllows(tx, input.locationId, item.jenis);

    const tanggal = input.tanggal ?? new Date();
    const key = input.idempotencyKey?.trim() || `penerimaan:${randomUUID()}`;
    const movement = await postInventoryMovementInTransaction(tx, {
      itemId: input.itemId,
      toLocationId: input.locationId,
      type: "OPENING",
      quantity: input.jumlah,
      idempotencyKey: key,
      sourceType: "PENERIMAAN_BAHAN",
      sourceId: key,
      reason: input.keterangan?.trim() || `Penerimaan bahan ${item.kode}`,
      userId,
      occurredAt: tanggal,
      syncItemStok: true,
    });
    const updated = await tx.item.findUniqueOrThrow({
      where: { id: input.itemId },
      select: { id: true, kode: true, nama: true, unit: true, stok: true },
    });
    const lokasiStok = await getItemStockAtLocation(tx, input.itemId, input.locationId);
    return { movement, item: updated, lokasiStok };
  });
}

export { InventoryError };
