import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PRODUCTION_ORDER_OKTOBER_2026 } from "./data/master-produksi-oktober-2026.js";
import { PRODUCTION_CAPACITY_OKTOBER_2026 } from "./data/kapasitas-produksi-oktober-2026.js";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpassword",
  database: process.env.DB_NAME || "express_api",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

// Resolve (product, style, color, size) -> variantId.
// Variant dibuat bila belum ada (kode = PREFIX + nomor urut milik produk).
async function resolveVariantId(
  productNama: string,
  styleNama: string,
  colorNama: string,
  sizeNama: string,
): Promise<number> {
  const [product, style, color, size] = await Promise.all([
    prisma.product.findFirst({ where: { nama: productNama } }),
    prisma.style.findFirst({ where: { nama: styleNama } }),
    prisma.color.findFirst({ where: { nama: colorNama } }),
    prisma.size.findFirst({ where: { nama: sizeNama } }),
  ]);
  if (!product || !style || !color || !size) {
    throw new Error(
      `Master tidak ditemukan: product=${productNama} style=${styleNama} color=${colorNama} size=${sizeNama}. Jalankan seed utama dulu.`,
    );
  }

  const existing = await prisma.productVariant.findUnique({
    where: {
      productId_styleId_colorId_sizeId: {
        productId: product.id,
        styleId: style.id,
        colorId: color.id,
        sizeId: size.id,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const last = await prisma.productVariant.findFirst({
    where: { productId: product.id },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const created = await prisma.productVariant.create({
    data: {
      productId: product.id,
      styleId: style.id,
      colorId: color.id,
      sizeId: size.id,
      kodeVariant: `${product.prefix.toUpperCase()}${String((last?.id ?? 0) + 1).padStart(3, "0")}`,
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const src = PRODUCTION_ORDER_OKTOBER_2026;
  const totalQty = src.items.reduce((sum, i) => sum + i.qty, 0);

  const order = await prisma.productionOrder.upsert({
    where: { nomor: src.nomor },
    update: { periode: src.periode, label: src.label, totalQty, status: src.status },
    create: { nomor: src.nomor, periode: src.periode, label: src.label, totalQty, status: src.status },
  });

  for (const it of src.items) {
    const variantId = await resolveVariantId(src.product, it.style, it.color, it.size);
    await prisma.productionOrderItem.upsert({
      where: { orderId_variantId: { orderId: order.id, variantId } },
      update: { qty: it.qty, priority: it.priority },
      create: { orderId: order.id, variantId, qty: it.qty, priority: it.priority },
    });
  }

  // Total kapasitas = demand master: decal ikut style-nya, sisanya total order.
  const styleSum = (kw: string) =>
    src.items.filter((i) => i.style.toUpperCase().includes(kw)).reduce((n, i) => n + i.qty, 0);
  const totalOf = (stage: string) => {
    const s = stage.toUpperCase();
    if (s.includes("DECAL SOLID")) return styleSum("SOLID") || totalQty;
    if (s.includes("DECAL MOTIF")) return styleSum("MOTIF") || totalQty;
    return totalQty;
  };

  for (const cap of PRODUCTION_CAPACITY_OKTOBER_2026) {
    const data = { ...cap, totalKapasitas: totalOf(cap.stage), mulai: new Date(cap.mulai), selesai: new Date(cap.selesai) };
    await prisma.productionCapacity.upsert({
      where: { orderId_stage: { orderId: order.id, stage: cap.stage } },
      update: data,
      create: { orderId: order.id, ...data },
    });
  }

  console.log(`Production order ${src.nomor} (${totalQty} pcs, ${src.items.length} baris, ${PRODUCTION_CAPACITY_OKTOBER_2026.length} tahap kapasitas) tersimpan.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
