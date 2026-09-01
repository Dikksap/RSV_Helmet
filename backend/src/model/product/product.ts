import prisma from "../../lib/prisma.js";
import redis from "../../lib/redis.js";

// =============================================
// Konstanta cache
// =============================================

const CACHE_KEY_ALL      = "products:all";
const CACHE_KEY_ONE      = (id: number) => `products:${id}`;
const CACHE_KEY_VARIANTS = (id: number) => `products:${id}:variants`;
const CACHE_TTL          = 60; // detik

// include relasi lengkap untuk response
export const variantInclude = {
  style: { select: { id: true, nama: true } },
  color: { select: { id: true, nama: true } },
  size:  { select: { id: true, nama: true, urutan: true } },
};

// =============================================
// Kode variant
// Format: <PREFIX produk kapital><nomor urut 3 digit>
// Nomor = varian terakhir milik produk itu + 1
// =============================================

export async function generateKodeVariant(productId: number): Promise<string> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { prefix: true },
  });

  if (!product) {
    throw new Error("Produk tidak ditemukan");
  }

  const lastVariant = await prisma.productVariant.findFirst({
    where: { productId },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextId = (lastVariant?.id ?? 0) + 1;
  return `${product.prefix.toUpperCase()}${String(nextId).padStart(3, "0")}`;
}

// =============================================
// Invalidation cache produk
// Dipakai internal + diimpor model lain
// =============================================

export async function invalidateProductCache(productId: number) {
  await redis.del(CACHE_KEY_ALL, CACHE_KEY_ONE(productId), CACHE_KEY_VARIANTS(productId));
}

// =============================================
// Query produk
// =============================================

export async function getAllProducts() {
  const cachedProducts = await redis.get(CACHE_KEY_ALL);
  if (cachedProducts) {
    return JSON.parse(cachedProducts);
  }

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        include: variantInclude,
        orderBy: { size: { urutan: "asc" } },
      },
    },
  });

  await redis.setex(CACHE_KEY_ALL, CACHE_TTL, JSON.stringify(products));

  return products;
}

export async function getProductById(id: number) {
  const cachedProduct = await redis.get(CACHE_KEY_ONE(id));
  if (cachedProduct) {
    return JSON.parse(cachedProduct);
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        include: variantInclude,
        orderBy: { size: { urutan: "asc" } },
      },
    },
  });

  if (!product) {
    return null;
  }

  await redis.setex(CACHE_KEY_ONE(id), CACHE_TTL, JSON.stringify(product));

  return product;
}

export async function createProduct(data: { nama: string; prefix: string }) {
  const product = await prisma.product.create({
    data,
    include: {
      variants: { include: variantInclude },
    },
  });

  await redis.del(CACHE_KEY_ALL);

  return product;
}

export async function updateProduct(id: number, nama: string) {
  const product = await prisma.product.update({
    where: { id },
    data:  { nama },
    include: {
      variants: { include: variantInclude },
    },
  });

  await redis.del(CACHE_KEY_ALL, CACHE_KEY_ONE(id));

  return product;
}

export async function deleteProduct(id: number) {
  await prisma.product.delete({ where: { id } });

  await invalidateProductCache(id);
}

// =============================================
// Query variant milik produk
// =============================================

export async function getProductVariants(id: number) {
  const cachedVariants = await redis.get(CACHE_KEY_VARIANTS(id));
  if (cachedVariants) {
    return JSON.parse(cachedVariants);
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    include: variantInclude,
    orderBy: { size: { urutan: "asc" } },
  });

  await redis.setex(CACHE_KEY_VARIANTS(id), CACHE_TTL, JSON.stringify(variants));

  return variants;
}

export async function createProductVariant(
  productId: number,
  data: { styleId: number; colorId: number; sizeId: number; tanggal?: Date }
) {
  const kodeVariant = await generateKodeVariant(productId);

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      ...data,
      kodeVariant,
    },
    include: variantInclude,
  });

  await invalidateProductCache(productId);

  return variant;
}

export async function updateProductVariant(
  productId: number,
  variantId: number,
  data: { tanggal?: Date }
) {
  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data,
    include: variantInclude,
  });

  await invalidateProductCache(productId);

  return variant;
}

export async function deleteProductVariant(productId: number, variantId: number) {
  await prisma.productVariant.delete({ where: { id: variantId } });

  await invalidateProductCache(productId);
}
