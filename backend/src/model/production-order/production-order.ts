import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

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
  items?: CreateOrderItemInput[];
};

function totalOf(items: { qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

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
      totalQty: totalOf(items),
      items: {
        create: items.map((it) => ({
          variantId: it.variantId,
          qty: it.qty,
          priority: it.priority ?? 0,
        })),
      },
    },
    include: { items: itemsWithVariant },
  });
}

export async function updateOrder(
  id: number,
  data: { nomor?: string; periode?: string; label?: string; status?: "DRAFT" | "AKTIF" | "SELESAI" | "BATAL" },
) {
  return prisma.productionOrder.update({
    where: { id },
    data: {
      ...(data.nomor !== undefined && { nomor: data.nomor.trim() }),
      ...(data.periode !== undefined && { periode: data.periode.trim() }),
      ...(data.label !== undefined && { label: data.label.trim() || null }),
      ...(data.status !== undefined && { status: data.status }),
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
