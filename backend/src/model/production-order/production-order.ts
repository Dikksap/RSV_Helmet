import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export const variantDetail = {
  product: { select: { id: true, nama: true, prefix: true } },
  style: { select: { id: true, nama: true } },
  color: { select: { id: true, nama: true } },
  size: { select: { id: true, nama: true, urutan: true } },
};

const itemsWithVariant = {
  include: { variant: { include: variantDetail } },
  orderBy: [{ priority: "asc" as const }, { variantId: "asc" as const }],
};

export type CreateOrderItemInput = {
  variantId: number;
  qty: number;
  priority?: number;
};

export type CreateOrderInput = {
  nomor: string;
  periode: string;
  label?: string;
  status?: "DRAFT" | "AKTIF" | "SELESAI" | "BATAL";
  mulaiProduksi?: string | null;
  items?: CreateOrderItemInput[];
};

function totalOf(items: { qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

// Tahap baku lini produksi (nama sama dengan sheet + seed kapasitas).
// Dibuat otomatis tiap order baru agar tab Kapasitas langsung ada isi;
// angka diisi user lewat Edit (mulai dari 0).
export const DEFAULT_CAPACITY_STAGES = [
  "BUFFING",
  "BASE COAT",
  "DECAL SOLID",
  "DECAL MOTIF",
  "TOP COAT",
  "PERAKITAN",
  "QC",
];

export async function getAllOrders() {
  return prisma.productionOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: false, _count: { select: { items: true } } },
  });
}

export async function getOrderById(id: number) {
  return prisma.productionOrder.findUnique({
    where: { id },
    include: { items: itemsWithVariant },
  });
}

export async function getOrderSummary(id: number) {
  const order = await getOrderById(id);
  if (!order) return null;
  const perItem = new Map<string, { item: string; total: number; priority: number }>();
  for (const it of order.items) {
    const label = `${it.variant.style.nama} ${it.variant.color.nama}`;
    const cur = perItem.get(label) ?? { item: label, total: 0, priority: it.priority };
    cur.total += it.qty;
    perItem.set(label, cur);
  }
  const ringkasan = [...perItem.values()].map((r) => ({
    ...r,
    persentase: order.totalQty > 0 ? Number(((r.total / order.totalQty) * 100).toFixed(2)) : 0,
  }));
  return { ...order, ringkasan };
}

export async function createOrder(data: CreateOrderInput) {
  const items = data.items ?? [];
  return prisma.productionOrder.create({
    data: {
      nomor: data.nomor.trim(),
      periode: data.periode.trim(),
      label: data.label?.trim() || null,
      status: data.status ?? "AKTIF",
      mulaiProduksi: data.mulaiProduksi ? new Date(data.mulaiProduksi) : null,
      totalQty: totalOf(items),
      items: {
        create: items.map((it) => ({
          variantId: it.variantId,
          qty: it.qty,
          priority: it.priority ?? 0,
        })),
      },
      capacities: {
        create: DEFAULT_CAPACITY_STAGES.map((stage, i) => ({ stage, urutan: i + 1 })),
      },
    },
    include: { items: itemsWithVariant },
  });
}

export async function updateOrder(
  id: number,
  data: { nomor?: string; periode?: string; label?: string; status?: "DRAFT" | "AKTIF" | "SELESAI" | "BATAL"; mulaiProduksi?: string | null },
) {
  return prisma.productionOrder.update({
    where: { id },
    data: {
      ...(data.nomor !== undefined && { nomor: data.nomor.trim() }),
      ...(data.periode !== undefined && { periode: data.periode.trim() }),
      ...(data.label !== undefined && { label: data.label.trim() || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.mulaiProduksi !== undefined && { mulaiProduksi: data.mulaiProduksi ? new Date(data.mulaiProduksi) : null }),
    },
    include: { items: itemsWithVariant },
  });
}

export async function deleteOrder(id: number) {
  await prisma.productionOrder.delete({ where: { id } });
}

export async function addOrderItem(orderId: number, data: CreateOrderItemInput) {
  const item = await prisma.productionOrderItem.create({
    data: { orderId, variantId: data.variantId, qty: data.qty, priority: data.priority ?? 0 },
    include: { variant: { include: variantDetail } },
  });
  await syncTotal(orderId);
  return item;
}

export async function deleteOrderItem(orderId: number, itemId: number) {
  await prisma.productionOrderItem.delete({ where: { id: itemId } });
  await syncTotal(orderId);
}

export async function updateOrderItem(
  orderId: number,
  itemId: number,
  data: { qty?: number; priority?: number },
) {
  const item = await prisma.productionOrderItem.update({
    where: { id: itemId },
    data,
    include: { variant: { include: variantDetail } },
  });
  await syncTotal(orderId);
  return item;
}

async function syncTotal(orderId: number) {
  const items = await prisma.productionOrderItem.findMany({ where: { orderId }, select: { qty: true } });
  await prisma.productionOrder.update({ where: { id: orderId }, data: { totalQty: totalOf(items) } });
}

// =============================================
// Kapasitas produksi per tahap
// Replace-all: form diisi lengkap lalu disimpan.
// hariKerja & totalKapasitas disimpan mentah.
// =============================================

export type UpsertCapacityInput = {
  stage: string;
  kapasitasWeekday?: number;
  kapasitasSabtu?: number;
  mulai?: string;
  selesai?: string;
  hariKerja?: number;
  totalKapasitas?: number;
  catatan?: string | null;
  urutan?: number;
};

const capacityOrder = [{ urutan: "asc" as const }, { id: "asc" as const }];

export async function getCapacities(orderId: number) {
  return prisma.productionCapacity.findMany({ where: { orderId }, orderBy: capacityOrder });
}

export async function replaceCapacities(orderId: number, items: UpsertCapacityInput[]) {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) {
    throw Object.assign(new Error("Production order tidak ditemukan"), { code: "P2025" });
  }
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.productionCapacity.deleteMany({ where: { orderId } });
    if (items.length > 0) {
      await tx.productionCapacity.createMany({
        data: items.map((it) => ({
          orderId,
          stage: it.stage.trim(),
          kapasitasWeekday: it.kapasitasWeekday ?? 0,
          kapasitasSabtu: it.kapasitasSabtu ?? 0,
          mulai: it.mulai ? new Date(it.mulai) : null,
          selesai: it.selesai ? new Date(it.selesai) : null,
          hariKerja: it.hariKerja ?? 0,
          totalKapasitas: it.totalKapasitas ?? 0,
          catatan: it.catatan?.trim() || null,
          urutan: it.urutan ?? 0,
        })),
      });
    }
    return tx.productionCapacity.findMany({ where: { orderId }, orderBy: capacityOrder });
  });
}

// =============================================
// Realisasi produksi harian per item variant.
// Rencana harian dibaca dari jadwal (buildSchedule), bukan disimpan.
// Aktual tersimpan per (orderId, variantId, tanggal); tanggal
// dinormalisasi ke awal hari lokal saat tulis maupun baca.
// =============================================

export type RealisasiRow = { tanggal: string; variantId: number; qty: number; reject: number };

export type SaveRealisasiItem = { variantId: number; qty: number; reject?: number };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  const s = startOfDay(d);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

function endOfDay(d: Date): Date {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
}

export async function getRealisasi(
  orderId: number,
  awal: Date | null,
  akhir: Date | null,
): Promise<RealisasiRow[]> {
  const rows = await prisma.productionRealization.findMany({
    where: {
      orderId,
      ...(awal && akhir ? { tanggal: { gte: startOfDay(awal), lte: endOfDay(akhir) } } : {}),
    },
    orderBy: [{ tanggal: "asc" }, { variantId: "asc" }],
  });
  return rows.map((r) => ({ tanggal: dayKey(r.tanggal), variantId: r.variantId, qty: r.qty, reject: r.reject }));
}

// Hitungan Barang FINISHGOOD per tanggal per variant sebagai saran
// pengisian aktual. Hanya variant milik order yang dihitung.
export async function getFinishgoodCounts(
  orderId: number,
  awal: Date | null,
  akhir: Date | null,
): Promise<RealisasiRow[]> {
  const items = await prisma.productionOrderItem.findMany({ where: { orderId }, select: { variantId: true } });
  if (items.length === 0) return [];
  const conds = [
    Prisma.sql`b.status = 'FINISHGOOD'`,
    ...(awal && akhir
      ? [Prisma.sql`b.tanggal >= ${startOfDay(awal)} AND b.tanggal <= ${endOfDay(akhir)}`]
      : []),
    Prisma.sql`b.variantId IN (${Prisma.join(items.map((i) => i.variantId))})`,
  ];
  const where = Prisma.join(conds, " AND ");
  const rows = await prisma.$queryRaw<{ tanggal: Date; variantId: number; qty: bigint }[]>(Prisma.sql`
    SELECT DATE(b.tanggal) AS tanggal, b.variantId AS variantId, COUNT(*) AS qty
    FROM Barang b
    WHERE ${where}
    GROUP BY DATE(b.tanggal), b.variantId`);
  return rows.map((r) => ({ tanggal: dayKey(r.tanggal), variantId: r.variantId, qty: Number(r.qty), reject: 0 }));
}

export async function saveRealisasi(
  orderId: number,
  tanggal: Date,
  items: SaveRealisasiItem[],
): Promise<RealisasiRow[]> {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) {
    throw Object.assign(new Error("Production order tidak ditemukan"), { code: "P2025" });
  }
  const day = startOfDay(tanggal);
  await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.productionRealization.deleteMany({ where: { orderId, tanggal: day } });
    const data = items
      .filter((it) => it.qty > 0 || (it.reject ?? 0) > 0)
      .map((it) => ({ orderId, variantId: it.variantId, tanggal: day, qty: it.qty, reject: it.reject ?? 0 }));
    if (data.length > 0) await tx.productionRealization.createMany({ data });
  });
  return getRealisasi(orderId, day, day);
}

// Tahap baku realisasi harian (kunci sama dengan kolom ScheduleRow).
export const REALISASI_STAGES = ["buffing", "baseCoat", "decalSolid", "decalMotif", "topCoat", "perakitan", "qc"] as const;

export type RealisasiStage = (typeof REALISASI_STAGES)[number];

export type RealisasiStageRow = { tanggal: string; stage: string; qty: number };

export async function getRealisasiStages(
  orderId: number,
  awal: Date | null,
  akhir: Date | null,
): Promise<RealisasiStageRow[]> {
  const rows = await prisma.productionRealizationStage.findMany({
    where: {
      orderId,
      ...(awal && akhir ? { tanggal: { gte: startOfDay(awal), lte: endOfDay(akhir) } } : {}),
    },
    orderBy: [{ tanggal: "asc" }, { stage: "asc" }],
  });
  return rows.map((r) => ({ tanggal: dayKey(r.tanggal), stage: r.stage, qty: r.qty }));
}

export async function saveRealisasiStages(
  orderId: number,
  tanggal: Date,
  items: { stage: string; qty: number }[],
): Promise<RealisasiStageRow[]> {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) {
    throw Object.assign(new Error("Production order tidak ditemukan"), { code: "P2025" });
  }
  const day = startOfDay(tanggal);
  await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.productionRealizationStage.deleteMany({ where: { orderId, tanggal: day } });
    const data = items.filter((it) => it.qty > 0).map((it) => ({ orderId, tanggal: day, stage: it.stage, qty: it.qty }));
    if (data.length > 0) await tx.productionRealizationStage.createMany({ data });
  });
  return getRealisasiStages(orderId, day, day);
}
