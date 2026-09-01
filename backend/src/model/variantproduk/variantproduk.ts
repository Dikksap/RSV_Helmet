import { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../lib/prisma.js";
import redis from "../../lib/redis.js";
import {
  variantInclude,
  generateKodeVariant,
  invalidateProductCache,
} from "../product/product.js";

// =============================================
// Konstanta cache
// =============================================

const CACHE_KEY_PREFIX = "variantproduk:";
const CACHE_TTL        = 60; // detik

// =============================================
// Types
// =============================================

export type VariantProdukRow = {
  id: number;
  kodeVariant: string;
  productId: number;
  namaProduk: string;
  styleId: number;
  namaStyle: string;
  colorId: number;
  namaColor: string;
  sizeId: number;
  namaSize: string;
  urutanSize: number;
  tanggal: Date;
};

export type VariantFilters = {
  productId?: number;
  styleId?: number;
  colorId?: number;
  sizeId?: number;
};

// =============================================
// Helpers
// =============================================

/** Bangun WHERE clause yang parameterized dari filter query params */
function buildWhere(filters: VariantFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`];

  if (filters.productId !== undefined) conditions.push(Prisma.sql`v.productId = ${filters.productId}`);
  if (filters.styleId   !== undefined) conditions.push(Prisma.sql`v.styleId = ${filters.styleId}`);
  if (filters.colorId   !== undefined) conditions.push(Prisma.sql`v.colorId = ${filters.colorId}`);
  if (filters.sizeId    !== undefined) conditions.push(Prisma.sql`v.sizeId = ${filters.sizeId}`);

  return Prisma.join(conditions, " AND ");
}

async function findVariantProduk(filters: VariantFilters): Promise<VariantProdukRow[]> {
  return prisma.$queryRaw<VariantProdukRow[]>`
    SELECT v.id, v.kodeVariant, v.productId, v.namaProduk,
           v.styleId, v.namaStyle, v.colorId, v.namaColor,
           v.sizeId, v.namaSize, v.urutanSize, v.tanggal
    FROM ViewVariantProduk v
    WHERE ${buildWhere(filters)}
    ORDER BY v.namaProduk ASC, v.urutanSize ASC`;
}

// =============================================
// Query variant produk (cache-aware)
// Cache key mengikuti kombinasi filter aktif
// =============================================

export async function getVariantProduk(filters: VariantFilters): Promise<VariantProdukRow[]> {
  const cacheKey =
    CACHE_KEY_PREFIX + (Object.keys(filters).length ? JSON.stringify(filters) : "all");

  const cachedRows = await redis.get(cacheKey);
  if (cachedRows) {
    return JSON.parse(cachedRows);
  }

  const rows = await findVariantProduk(filters);

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rows));

  return rows;
}

// =============================================
// Detail variant by ID (via view)
// Tidak di-cache — murah dan selalu segar
// =============================================

export async function getVariantProdukById(id: number): Promise<VariantProdukRow | null> {
  const rows = await prisma.$queryRaw<VariantProdukRow[]>`
    SELECT v.id, v.kodeVariant, v.productId, v.namaProduk,
           v.styleId, v.namaStyle, v.colorId, v.namaColor,
           v.sizeId, v.namaSize, v.urutanSize, v.tanggal
    FROM ViewVariantProduk v
    WHERE v.id = ${id}
    LIMIT 1`;

  return rows[0] ?? null;
}

// =============================================
// Hapus semua cache view variant produk
// Dipanggil setiap operasi tulis — kombinasi
// filter cache tidak terbatas, jadi SCAN wildcard
// =============================================

async function clearVariantProdukCache() {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${CACHE_KEY_PREFIX}*`, "COUNT", 100);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

/** Bersihkan cache view + cache products untuk productId terkait */
async function invalidateAfterWrite(productId: number) {
  await clearVariantProdukCache();
  await invalidateProductCache(productId);
}

// =============================================
// Create / Update / Delete variant
// Return null = data tidak ditemukan (P2025)
// Error P2002 (duplikat) dilempar ke controller
// =============================================

export interface CreateVariantInput {
  productId: number;
  styleId: number;
  colorId: number;
  sizeId: number;
  tanggal?: Date;
}

export async function createVariant(input: CreateVariantInput) {
  const kodeVariant = await generateKodeVariant(input.productId);

  const variant = await prisma.productVariant.create({
    data: {
      productId: input.productId,
      styleId: input.styleId,
      colorId: input.colorId,
      sizeId: input.sizeId,
      tanggal: input.tanggal,
      kodeVariant,
    },
    include: variantInclude,
  });

  await invalidateAfterWrite(input.productId);

  return variant;
}

export type UpdateVariantData = {
  styleId?: number;
  colorId?: number;
  sizeId?: number;
  tanggal?: Date;
};

export async function updateVariant(id: number, data: UpdateVariantData) {
  try {
    const variant = await prisma.productVariant.update({
      where: { id },
      data,
      include: variantInclude,
    });

    await invalidateAfterWrite(variant.productId);

    return variant;
  } catch (error: any) {
    if (error?.code === "P2025") {
      return null;
    }
    throw error;
  }
}

export async function deleteVariant(id: number): Promise<boolean> {
  try {
    const variant = await prisma.productVariant.delete({
      where: { id },
      select: { productId: true },
    });

    await invalidateAfterWrite(variant.productId);

    return true;
  } catch (error: any) {
    if (error?.code === "P2025") {
      return false;
    }
    throw error;
  }
}
