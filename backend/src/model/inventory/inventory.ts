import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { createHash } from "node:crypto";
import { syncItemStok } from "../stokItem/stokItem.js";

export class InventoryError extends Error {
  constructor(
    public readonly code:
      | "INVALID_MOVEMENT"
      | "LOCATION_NOT_FOUND"
      | "ITEM_NOT_FOUND"
      | "LOT_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "IDEMPOTENCY_CONFLICT"
      | "MOVEMENT_NOT_FOUND"
      | "ALREADY_REVERSED"
      | "SCOPE_DENIED"
      | "ADJUSTMENT_NOT_FOUND"
      | "ADJUSTMENT_ALREADY_REVIEWED"
      | "ADJUSTMENT_SELF_APPROVAL"
      | "STALE_ADJUSTMENT"
      | "NO_DIFFERENCE",
    message: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

type LocationOwner = { id: number; name: string; isActive: boolean };

export async function ensureDivisionInventoryLocation(
  tx: PrismaTransactionClient,
  divisionId: number,
) {
  const division = await tx.divisi.findUnique({
    where: { id: divisionId },
    select: { id: true, nama: true },
  });
  if (!division) {
    throw new InventoryError("LOCATION_NOT_FOUND", "Divisi tidak ditemukan");
  }
  const location = await tx.inventoryLocation.upsert({
    where: { divisiId: division.id },
    update: {},
    create: {
      code: `DIV-${division.id}`,
      name: division.nama,
      type: "DIVISION",
      divisiId: division.id,
    },
  });
  if (!location.isActive) {
    throw new InventoryError(
      "LOCATION_NOT_FOUND",
      `Lokasi divisi ${division.nama} tidak aktif`,
    );
  }
  return location;
}

export async function getDivisionInventoryLocationId(divisiId: number) {
  const location = await prisma.inventoryLocation.findUnique({
    where: { divisiId },
    select: { id: true },
  });
  return location?.id ?? null;
}

export async function getInventoryLocationDetails(locationId: number) {
  return prisma.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { id: true, type: true, divisiId: true, isActive: true },
  });
}

export async function listInventoryLocations(
  divisiId?: number,
  warehouseOnly = false,
) {
  return prisma.inventoryLocation.findMany({
    ...((divisiId === undefined && !warehouseOnly)
      ? {}
      : {
          where: {
            ...(divisiId !== undefined
              ? { divisiId, type: "DIVISION" as const }
              : {}),
            ...(warehouseOnly ? { type: "WAREHOUSE" as const } : {}),
          },
        }),
    include: {
      gudang: { select: { id: true, kode: true, name: true } },
      divisi: { select: { id: true, nama: true } },
    },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
}

export async function mapWarehouseLocation(gudangId: number) {
  const warehouse = await prisma.gudang.findUnique({
    where: { id: gudangId },
    select: { id: true, name: true, isActive: true },
  });
  if (!warehouse)
    throw new InventoryError("LOCATION_NOT_FOUND", "Gudang tidak ditemukan");
  return mapLocation("WAREHOUSE", warehouse, `WH-${gudangId}`);
}

export async function mapDivisionLocation(divisiId: number) {
  const division = await prisma.divisi.findUnique({
    where: { id: divisiId },
    select: { id: true, nama: true },
  });
  if (!division)
    throw new InventoryError("LOCATION_NOT_FOUND", "Divisi tidak ditemukan");
  return mapLocation(
    "DIVISION",
    { id: division.id, name: division.nama, isActive: true },
    `DIV-${divisiId}`,
  );
}

export async function listUnmappedLegacyItemBalances() {
  const legacyBalances = await prisma.stokItemMutasi.groupBy({
    by: ["itemId", "tipe"],
    _sum: { jumlah: true },
  });
  const balancesByItem = new Map<number, number>();
  for (const balance of legacyBalances) {
    const delta = Number(balance._sum.jumlah ?? 0);
    balancesByItem.set(
      balance.itemId,
      (balancesByItem.get(balance.itemId) ?? 0) +
        (balance.tipe === "MASUK" ? delta : -delta),
    );
  }
  const items = await prisma.item.findMany({
    where: {
      id: { in: [...balancesByItem.keys()] },
      defaultInventoryLocationId: null,
    },
    select: {
      id: true,
      kode: true,
      nama: true,
      unit: true,
      jenis: true,
    },
    orderBy: { kode: "asc" },
  });
  return items.map((item) => ({
    ...item,
    legacyBalance: balancesByItem.get(item.id) ?? 0,
  }));
}

export async function setItemDefaultInventoryLocation(
  itemId: number,
  locationId: number,
  userId: number,
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM Item WHERE id = ${itemId} FOR UPDATE`;
    const item = await tx.item.findUnique({
      where: { id: itemId },
      select: { id: true, kode: true, defaultInventoryLocationId: true },
    });
    if (!item) throw new InventoryError("ITEM_NOT_FOUND", "Item tidak ditemukan");

    await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${locationId} FOR UPDATE`;
    const location = await tx.inventoryLocation.findUnique({
      where: { id: locationId },
      select: { id: true, isActive: true },
    });
    if (!location?.isActive) {
      throw new InventoryError(
        "LOCATION_NOT_FOUND",
        "Lokasi tidak ditemukan atau tidak aktif",
      );
    }

    if (item.defaultInventoryLocationId === locationId) return item;
    if (item.defaultInventoryLocationId !== null) {
      const currentBalance = await tx.stockBalance.aggregate({
        where: {
          itemId,
          locationId: item.defaultInventoryLocationId,
          quantity: { not: 0 },
        },
        _sum: { quantity: true },
      });
      if (Number(currentBalance._sum.quantity ?? 0) !== 0) {
        throw new InventoryError(
          "INVALID_MOVEMENT",
          "Pindahkan stok dari lokasi lama sebelum mengganti lokasi default item",
        );
      }
      return tx.item.update({
        where: { id: itemId },
        data: { defaultInventoryLocationId: locationId },
        select: { id: true, kode: true, defaultInventoryLocationId: true },
      });
    }

    const legacy = await tx.stokItemMutasi.groupBy({
      by: ["tipe"],
      where: { itemId },
      _sum: { jumlah: true },
    });
    const openingBalance =
      (legacy.find((row) => row.tipe === "MASUK")?._sum.jumlah ?? 0) -
      (legacy.find((row) => row.tipe === "KELUAR")?._sum.jumlah ?? 0);
    if (openingBalance < 0) {
      throw new InventoryError(
        "INVALID_MOVEMENT",
        `Saldo legacy item ${item.kode} negatif; rekonsiliasi sebelum pemetaan lokasi`,
      );
    }

    if (openingBalance > 0) {
      await postInventoryMovementInTransaction(tx, {
        itemId,
        toLocationId: locationId,
        type: "OPENING",
        quantity: openingBalance,
        idempotencyKey: `legacy-item-opening:${itemId}:${locationId}`,
        sourceType: "LEGACY_STOCKITEM_OPENING",
        sourceId: String(itemId),
        reason: `Migrasi saldo legacy item ${item.kode} ke inventory`,
        userId,
      });
    }

    return tx.item.update({
      where: { id: itemId },
      data: { defaultInventoryLocationId: locationId },
      select: { id: true, kode: true, defaultInventoryLocationId: true },
    });
  });
}

async function mapLocation(
  type: "WAREHOUSE" | "DIVISION",
  owner: LocationOwner,
  code: string,
) {
  const data = {
    code,
    name: owner.name,
    type,
    isActive: owner.isActive,
    gudangId: type === "WAREHOUSE" ? owner.id : null,
    divisiId: type === "DIVISION" ? owner.id : null,
  };
  const unique =
    type === "WAREHOUSE" ? { gudangId: owner.id } : { divisiId: owner.id };
  const existing = await prisma.inventoryLocation.findFirst({ where: unique });
  if (existing) {
    return prisma.inventoryLocation.update({
      where: { id: existing.id },
      data: { code, name: owner.name, isActive: owner.isActive },
    });
  }
  return prisma.inventoryLocation.create({ data });
}

export async function listInventoryMovements(filters: {
  itemId?: number;
  barangId?: number;
  locationId?: number;
  locationIds?: number[];
  take: number;
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.barangId ? { barangId: filters.barangId } : {}),
      ...(filters.locationIds
        ? {
            OR: [
              { fromLocationId: { in: filters.locationIds } },
              { toLocationId: { in: filters.locationIds } },
            ],
          }
        : filters.locationId
        ? {
            OR: [
              { fromLocationId: filters.locationId },
              { toLocationId: filters.locationId },
            ],
          }
        : {}),
    },
    include: {
      item: { select: { id: true, kode: true, nama: true, unit: true } },
      barang: { select: { id: true, kodeBarang: true, status: true } },
      fromLocation: {
        select: { id: true, code: true, name: true, type: true },
      },
      toLocation: { select: { id: true, code: true, name: true, type: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: filters.take,
  });
}

export async function getItemStockAtLocation(
  tx: PrismaTransactionClient,
  itemId: number,
  locationId: number,
): Promise<number> {
  const row = await tx.stockBalance.aggregate({
    where: { itemId, locationId, batchId: null },
    _sum: { quantity: true },
  });
  return Number(row._sum.quantity ?? 0);
}

/** Transfer satu lot stok (lot 0 untuk stok non-WIP). Total Item.stok tidak berubah. */
export async function transferItemStock(
  tx: PrismaTransactionClient,
  input: {
    itemId: number;
    fromLocationId: number;
    toLocationId: number;
    batchId?: number | null;
    pemakaianMaterialItemId?: number | null;
    quantity: number;
    idempotencyKey: string;
    sourceType: string;
    sourceId: string;
    reason?: string | null;
    userId?: number | null;
  },
) {
  return postInventoryMovementInTransaction(tx, {
    ...input,
    type: "TRANSFER",
    syncItemStok: true,
  });
}

export async function getItemWarehouseBalances(itemId: number) {
  const locations = await prisma.inventoryLocation.findMany({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true, code: true, name: true, gudangId: true },
    orderBy: [{ code: "asc" }],
  });
  if (locations.length === 0) return [];

  const rows = await prisma.stockBalance.findMany({
    where: { itemId, locationId: { in: locations.map((location) => location.id) } },
    select: { locationId: true, quantity: true },
  });
  const balances = new Map<number, number>();
  for (const row of rows) {
    balances.set(row.locationId, (balances.get(row.locationId) ?? 0) + Number(row.quantity));
  }
  return locations.map((location) => ({
    ...location,
    balance: balances.get(location.id) ?? 0,
  }));
}

export async function transferItemBetweenWarehouses(input: {
  itemId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  idempotencyKey: string;
  reason: string;
  userId: number | null;
}) {
  const scaledQuantity = input.quantity * 1_000_000;
  if (
    !Number.isSafeInteger(input.itemId) ||
    input.itemId <= 0 ||
    !Number.isSafeInteger(input.fromLocationId) ||
    input.fromLocationId <= 0 ||
    !Number.isSafeInteger(input.toLocationId) ||
    input.toLocationId <= 0 ||
    input.fromLocationId === input.toLocationId ||
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isSafeInteger(Math.round(scaledQuantity)) ||
    Math.abs(scaledQuantity - Math.round(scaledQuantity)) > 1e-7 ||
    !input.idempotencyKey.trim() ||
    !input.reason.trim()
  ) {
    throw new InventoryError("INVALID_MOVEMENT", "Data transfer stok tidak valid");
  }
  const requestedMicros = Math.round(scaledQuantity);
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM Item WHERE id = ${input.itemId} FOR UPDATE`;
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true },
    });
    if (!item) throw new InventoryError("ITEM_NOT_FOUND", "Item tidak ditemukan");

    const prior = await tx.inventoryMovement.findMany({
      where: {
        itemId: input.itemId,
        sourceType: "ITEM_WAREHOUSE_TRANSFER",
        sourceId: input.idempotencyKey,
      },
      select: {
        type: true,
        quantity: true,
        fromLocationId: true,
        toLocationId: true,
        reason: true,
      },
    });
    if (prior.length > 0) {
      const priorMatches = prior.every((movement) =>
        movement.type === "TRANSFER" &&
        movement.fromLocationId === input.fromLocationId &&
        movement.toLocationId === input.toLocationId &&
        movement.reason === input.reason,
      );
      const priorQuantity = prior.reduce((total, movement) => total + Number(movement.quantity), 0);
      if (!priorMatches || Math.round(priorQuantity * 1_000_000) !== requestedMicros) {
        throw new InventoryError(
          "IDEMPOTENCY_CONFLICT",
          "Kunci idempotensi sudah dipakai untuk transfer yang berbeda",
        );
      }
      return { repeated: true, quantity: priorQuantity };
    }

    const locationIds = [input.fromLocationId, input.toLocationId].sort((a, b) => a - b);
    for (const locationId of locationIds) {
      await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${locationId} FOR UPDATE`;
    }
    const locations = await tx.inventoryLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, type: true, isActive: true },
    });
    if (locations.length !== locationIds.length || locations.some((location) => !location.isActive)) {
      throw new InventoryError("LOCATION_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif");
    }
    if (locations.some((location) => location.type !== "WAREHOUSE")) {
      throw new InventoryError("INVALID_MOVEMENT", "Transfer hanya dapat dilakukan antar gudang");
    }

    const sourceBalances = await tx.stockBalance.findMany({
      where: {
        itemId: input.itemId,
        locationId: input.fromLocationId,
        quantity: { gt: 0 },
      },
      select: { id: true, batchId: true, pemakaianMaterialItemId: true, quantity: true },
      orderBy: { id: "asc" },
    });
    const available = sourceBalances.reduce((total, row) => total + Number(row.quantity), 0);
    const availableMicros = sourceBalances.reduce(
      (total, row) => total + Math.round(Number(row.quantity) * 1_000_000),
      0,
    );
    if (availableMicros < requestedMicros) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Saldo gudang asal tidak cukup (tersedia ${available})`,
      );
    }

    let remainingMicros = requestedMicros;
    for (const balance of sourceBalances) {
      if (remainingMicros <= 0) break;
      const quantityMicros = Math.min(
        Math.round(Number(balance.quantity) * 1_000_000),
        remainingMicros,
      );
      if (quantityMicros <= 0) continue;
      await transferItemStock(tx, {
        itemId: input.itemId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        batchId: balance.batchId,
        pemakaianMaterialItemId: balance.pemakaianMaterialItemId,
        quantity: quantityMicros / 1_000_000,
        idempotencyKey: `${input.idempotencyKey}:${balance.id}`,
        sourceType: "ITEM_WAREHOUSE_TRANSFER",
        sourceId: input.idempotencyKey,
        reason: input.reason,
        userId: input.userId,
      });
      remainingMicros -= quantityMicros;
    }
    if (remainingMicros !== 0) {
      throw new InventoryError("INSUFFICIENT_STOCK", "Saldo gudang asal tidak cukup");
    }
    return { repeated: false, quantity: input.quantity };
  });
}

/**
 * Konsumsi stok di satu lokasi lintas lot (termasuk lot 0 dan WIP lama).
 * Setiap potongan lot menjadi satu movement; total Item.stok turun sekali.
 */
export async function consumeItemAtLocation(
  tx: PrismaTransactionClient,
  input: {
    itemId: number;
    locationId: number;
    quantity: number;
    idempotencyKey: string;
    sourceType: string;
    sourceId: string;
    reason?: string | null;
    userId?: number | null;
    occurredAt?: Date;
    produksiHarianId?: number | null;
    movementType?: "PRODUCTION" | "TRANSFER";
  },
) {
  const rows = await tx.stockBalance.findMany({
    where: {
      itemId: input.itemId,
      locationId: input.locationId,
      batchId: null,
      quantity: { gt: 0 },
    },
    select: { id: true, pemakaianMaterialItemId: true, quantity: true },
    orderBy: { id: "asc" },
  });
  const tersedia = rows.reduce((total, row) => total + Number(row.quantity), 0);
  if (tersedia + 0.000001 < input.quantity) {
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      `Saldo stok item ${input.itemId} di lokasi ${input.locationId} tidak cukup (tersedia ${tersedia})`,
    );
  }

  let sisa = input.quantity;
  for (const row of rows) {
    if (sisa <= 0.000001) break;
    const pakai = Math.min(Number(row.quantity), sisa);
    await postInventoryMovementInTransaction(tx, {
      itemId: input.itemId,
      ...(row.pemakaianMaterialItemId != null
        ? { pemakaianMaterialItemId: row.pemakaianMaterialItemId }
        : {}),
      ...(input.produksiHarianId != null ? { produksiHarianId: input.produksiHarianId } : {}),
      fromLocationId: input.locationId,
      type: input.movementType ?? "PRODUCTION",
      quantity: pakai,
      idempotencyKey: `${input.idempotencyKey}:${row.id}`,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      occurredAt: input.occurredAt,
      syncItemStok: true,
    });
    sisa -= pakai;
  }
  return tersedia - input.quantity;
}

export async function getInventoryBalances(filters: {
  itemId?: number;
  barangId?: number;
  locationId?: number;
  locationIds?: number[];
}) {
  const stockBalances = await prisma.stockBalance.findMany({
    where: {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.barangId ? { barangId: filters.barangId } : {}),
      ...(filters.locationIds
        ? { locationId: { in: filters.locationIds } }
        : filters.locationId
          ? { locationId: filters.locationId }
          : {}),
    },
    select: { itemId: true, barangId: true, locationId: true, quantity: true },
  });
  const totals = new Map<string, number>();
  for (const balance of stockBalances) {
    const stockKey =
      balance.itemId !== null
        ? `I:${balance.itemId}`
        : balance.barangId !== null
          ? `B:${balance.barangId}`
          : null;
    if (stockKey === null) continue;
    const key = `${stockKey}:${balance.locationId}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(balance.quantity));
  }
  return [...totals.entries()]
    .filter(([, quantity]) => quantity !== 0)
    .map(([key, quantity]) => {
      const [stockType, stockId, locationId] = key.split(":");
      return {
        itemId: stockType === "I" ? Number(stockId) : null,
        barangId: stockType === "B" ? Number(stockId) : null,
        locationId: Number(locationId),
        quantity,
      };
    });
}

export async function getInventoryItemSummary(
  itemIds: number[],
  range: { from?: Date; until?: Date } = {},
) {
  const ids = [...new Set(itemIds.filter((id) => Number.isInteger(id) && id > 0))];
  const summary = Object.fromEntries(ids.map((id) => [id, { masuk: 0, keluar: 0, net: 0 }]));
  if (ids.length === 0) return summary;

  const locations = await prisma.inventoryLocation.findMany({
    where: { type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });
  const locationIds = locations.map((location) => location.id);
  if (locationIds.length === 0) return summary;

  const occurredAt = {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.until ? { lt: range.until } : {}),
  };
  const dateFilter = Object.keys(occurredAt).length > 0 ? { occurredAt } : {};
  const [incoming, outgoing] = await Promise.all([
    prisma.inventoryMovement.groupBy({
      by: ["itemId"],
      where: {
        itemId: { in: ids },
        toLocationId: { in: locationIds },
        ...dateFilter,
      },
      _sum: { quantity: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ["itemId"],
      where: {
        itemId: { in: ids },
        fromLocationId: { in: locationIds },
        ...dateFilter,
      },
      _sum: { quantity: true },
    }),
  ]);
  for (const row of incoming) {
    if (row.itemId !== null) summary[row.itemId].masuk += Number(row._sum.quantity ?? 0);
  }
  for (const row of outgoing) {
    if (row.itemId !== null) summary[row.itemId].keluar += Number(row._sum.quantity ?? 0);
  }
  for (const id of ids) summary[id].net = summary[id].masuk - summary[id].keluar;
  return summary;
}

export async function getWarehouseItemBalances(itemIds: number[]) {
  const ids = [...new Set(itemIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return {};

  const rows = await prisma.stockBalance.findMany({
    where: {
      itemId: { in: ids },
      location: { type: "WAREHOUSE", isActive: true },
    },
    select: { itemId: true, quantity: true },
  });
  const balances: Record<number, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const row of rows) {
    if (row.itemId !== null) balances[row.itemId] = (balances[row.itemId] ?? 0) + Number(row.quantity);
  }
  return balances;
}

export async function getInventoryItemTotals(itemIds: number[]) {
  const ids = [...new Set(itemIds.filter((id) => Number.isInteger(id) && id > 0))];
  const totals: Record<number, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  if (ids.length === 0) return totals;

  const rows = await prisma.stockBalance.groupBy({
    by: ["itemId"],
    where: {
      itemId: { in: ids },
      location: { isActive: true },
    },
    _sum: { quantity: true },
  });
  for (const row of rows) {
    if (row.itemId !== null) totals[row.itemId] = Number(row._sum.quantity ?? 0);
  }
  return totals;
}

const stockAdjustmentInclude = {
  item: { select: { id: true, kode: true, nama: true, unit: true } },
  location: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      divisiId: true,
    },
  },
  requester: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  movement: { select: { id: true, occurredAt: true } },
} as const;

export async function listStockAdjustments(filters: {
  divisiId?: number;
  warehouseOnly?: boolean;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}) {
  return prisma.stockAdjustment.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.divisiId !== undefined || filters.warehouseOnly
        ? {
            location: {
              ...(filters.divisiId !== undefined
                ? { divisiId: filters.divisiId }
                : {}),
              ...(filters.warehouseOnly ? { type: "WAREHOUSE" as const } : {}),
            },
          }
        : {}),
    },
    include: stockAdjustmentInclude,
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

export async function requestStockAdjustment(input: {
  itemId: number;
  locationId: number;
  batchId?: number | null;
  physicalQuantity: number;
  reason: string;
  requestedById: number;
}) {
  if (
    !Number.isSafeInteger(input.itemId) ||
    input.itemId <= 0 ||
    !Number.isSafeInteger(input.locationId) ||
    input.locationId <= 0 ||
    (input.batchId != null &&
      (!Number.isSafeInteger(input.batchId) || input.batchId <= 0)) ||
    !Number.isFinite(input.physicalQuantity) ||
    input.physicalQuantity < 0 ||
    !Number.isSafeInteger(input.physicalQuantity * 1_000_000) ||
    input.reason.trim().length < 5
  ) {
    throw new InventoryError("INVALID_MOVEMENT", "Data adjustment tidak valid");
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${input.locationId} FOR UPDATE`;
    const [item, location] = await Promise.all([
      tx.item.findUnique({
        where: { id: input.itemId },
        select: { id: true },
      }),
      tx.inventoryLocation.findUnique({
        where: { id: input.locationId },
        select: { id: true, isActive: true },
      }),
    ]);
    if (!item) throw new InventoryError("ITEM_NOT_FOUND", "Item tidak ditemukan");
    if (!location?.isActive) {
      throw new InventoryError(
        "LOCATION_NOT_FOUND",
        "Lokasi tidak ditemukan atau tidak aktif",
      );
    }

    const balanceWhere = {
      itemId: input.itemId,
      locationId: input.locationId,
      batchId: input.batchId ?? null,
    };
    const currentBalance = await tx.stockBalance.aggregate({
      where: balanceWhere,
      _sum: { quantity: true },
    });
    const systemQuantity = Number(currentBalance._sum.quantity ?? 0);
    const difference = input.physicalQuantity - systemQuantity;
    if (quantityUnits(difference) === 0) {
      throw new InventoryError(
        "NO_DIFFERENCE",
        "Jumlah fisik sama dengan saldo sistem; adjustment tidak diperlukan",
      );
    }
    const latestMovement = await tx.inventoryMovement.findFirst({
      where: {
        itemId: input.itemId,
        batchId: input.batchId ?? null,
        OR: [
          { fromLocationId: input.locationId },
          { toLocationId: input.locationId },
        ],
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    return tx.stockAdjustment.create({
      data: {
        ...balanceWhere,
        systemQuantity,
        physicalQuantity: input.physicalQuantity,
        difference,
        snapshotMovementId: latestMovement?.id ?? null,
        reason: input.reason.trim(),
        requestedById: input.requestedById,
      },
      include: stockAdjustmentInclude,
    });
  });
}

export async function approveStockAdjustment(
  adjustmentId: number,
  reviewerId: number,
  divisiId?: number,
  reviewerIsAdmin = false,
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT locationId FROM StockAdjustment WHERE id = ${adjustmentId}`;
    const initial = await tx.stockAdjustment.findUnique({
      where: { id: adjustmentId },
      select: { id: true, locationId: true },
    });
    if (!initial) {
      throw new InventoryError(
        "ADJUSTMENT_NOT_FOUND",
        "Adjustment tidak ditemukan",
      );
    }
    await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${initial.locationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM StockAdjustment WHERE id = ${adjustmentId} FOR UPDATE`;
    const adjustment = await tx.stockAdjustment.findUnique({
      where: { id: adjustmentId },
    });
    if (!adjustment) {
      throw new InventoryError(
        "ADJUSTMENT_NOT_FOUND",
        "Adjustment tidak ditemukan",
      );
    }
    if (divisiId !== undefined) {
      const location = await tx.inventoryLocation.findUnique({
        where: { id: adjustment.locationId },
        select: { divisiId: true },
      });
      if (location?.divisiId !== divisiId) {
        throw new InventoryError(
          "SCOPE_DENIED",
          "Adjustment berada di luar divisi akun",
        );
      }
    }
    if (adjustment.status === "APPROVED") {
      return tx.stockAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
        include: stockAdjustmentInclude,
      });
    }
    if (adjustment.status !== "PENDING") {
      throw new InventoryError(
        "ADJUSTMENT_ALREADY_REVIEWED",
        "Adjustment sudah ditolak",
      );
    }
    if (adjustment.requestedById === reviewerId && !reviewerIsAdmin) {
      throw new InventoryError(
        "ADJUSTMENT_SELF_APPROVAL",
        "Pengaju tidak boleh menyetujui adjustment sendiri",
      );
    }

    const currentBalance = await tx.stockBalance.aggregate({
      where: {
        itemId: adjustment.itemId,
        locationId: adjustment.locationId,
        batchId: adjustment.batchId,
      },
      _sum: { quantity: true },
    });
    const currentQuantity = Number(currentBalance._sum.quantity ?? 0);
    if (
      quantityUnits(currentQuantity) !==
      quantityUnits(Number(adjustment.systemQuantity))
    ) {
      throw new InventoryError(
        "STALE_ADJUSTMENT",
        "Saldo berubah sejak adjustment diajukan; tolak dan ajukan ulang berdasarkan saldo terbaru",
      );
    }

    const difference = Number(adjustment.difference);
    const movement = await postInventoryMovementInTransaction(tx, {
      itemId: adjustment.itemId,
      batchId: adjustment.batchId,
      fromLocationId: difference < 0 ? adjustment.locationId : null,
      toLocationId: difference > 0 ? adjustment.locationId : null,
      type: "ADJUSTMENT",
      quantity: Math.abs(difference),
      idempotencyKey: `stock-adjustment:${adjustment.id}`,
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: String(adjustment.id),
      reason: adjustment.reason,
      userId: reviewerId,
      syncItemStok: true,
    });
    await tx.stockAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: "APPROVED",
        approvedById: reviewerId,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        movementId: movement.id,
      },
    });
    return tx.stockAdjustment.findUniqueOrThrow({
      where: { id: adjustment.id },
      include: stockAdjustmentInclude,
    });
  });
}

export async function rejectStockAdjustment(
  adjustmentId: number,
  reviewerId: number,
  reviewNotes: string,
  divisiId?: number,
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM StockAdjustment WHERE id = ${adjustmentId} FOR UPDATE`;
    const adjustment = await tx.stockAdjustment.findUnique({
      where: { id: adjustmentId },
    });
    if (!adjustment) {
      throw new InventoryError(
        "ADJUSTMENT_NOT_FOUND",
        "Adjustment tidak ditemukan",
      );
    }
    if (divisiId !== undefined) {
      const location = await tx.inventoryLocation.findUnique({
        where: { id: adjustment.locationId },
        select: { divisiId: true },
      });
      if (location?.divisiId !== divisiId) {
        throw new InventoryError(
          "SCOPE_DENIED",
          "Adjustment berada di luar divisi akun",
        );
      }
    }
    if (adjustment.status !== "PENDING") {
      throw new InventoryError(
        "ADJUSTMENT_ALREADY_REVIEWED",
        "Adjustment sudah direview",
      );
    }
    if (adjustment.requestedById === reviewerId) {
      throw new InventoryError(
        "ADJUSTMENT_SELF_APPROVAL",
        "Pengaju tidak boleh menolak adjustment sendiri",
      );
    }
    await tx.stockAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes.trim(),
      },
    });
    return tx.stockAdjustment.findUniqueOrThrow({
      where: { id: adjustment.id },
      include: stockAdjustmentInclude,
    });
  });
}

function quantityUnits(quantity: number) {
  return Math.round(quantity * 1_000_000);
}

export type InventoryMovementInput = {
  itemId?: number | null;
  barangId?: number | null;
  batchId?: number | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  pemakaianMaterialItemId?: number | null;
  hasilProduksiHarianId?: number | null;
  produksiHarianId?: number | null;
  type:
    | "OPENING"
    | "PRODUCTION"
    | "TRANSFER"
    | "QC"
    | "REPAIR"
    | "SHIPMENT"
    | "RETURN"
    | "ADJUSTMENT"
    | "REVERSAL";
  quantity: number;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  groupUuid?: string;
  reason?: string | null;
  userId?: number | null;
  occurredAt?: Date;
  /** Perbarui Item.stok untuk pergerakan satu arah. Transfer tidak mengubah total. */
  syncItemStok?: boolean;
};

export async function postInventoryMovement(input: InventoryMovementInput) {
  validateMovement(input);
  try {
    return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      return postInventoryMovementInTransaction(tx, input);
    });
  } catch (error) {
    if (isUniqueError(error)) {
      const prior = await prisma.inventoryMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (prior) {
        assertSameMovement(prior, input);
        return prior;
      }
    }
    throw error;
  }
}

export async function postInventoryMovementInTransaction(
  tx: PrismaTransactionClient,
  input: InventoryMovementInput,
) {
  validateMovement(input);
  const prior = await tx.inventoryMovement.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) {
    assertSameMovement(prior, input);
    return prior;
  }
  return createMovement(tx, input);
}

export async function reverseInventoryMovement(
  movementId: bigint,
  userId: number,
  reason: string,
  divisiId?: number,
) {
  try {
    return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.$queryRaw`SELECT id FROM InventoryMovement WHERE id = ${movementId} FOR UPDATE`;
      const original = await tx.inventoryMovement.findUnique({
        where: { id: movementId },
      });
      if (!original)
        throw new InventoryError(
          "MOVEMENT_NOT_FOUND",
          "Mutasi tidak ditemukan",
        );
      if (divisiId !== undefined) {
        const locationIds = [
          original.fromLocationId,
          original.toLocationId,
        ].filter((id): id is number => id !== null);
        const locations = await tx.inventoryLocation.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, divisiId: true },
        });
        if (
          locations.length !== locationIds.length ||
          locations.some((location) => location.divisiId !== divisiId)
        ) {
          throw new InventoryError(
            "SCOPE_DENIED",
            "Mutasi berada di luar divisi akun",
          );
        }
      }
      const existing = await tx.inventoryMovement.findUnique({
        where: { reversalOfId: original.id },
      });
      if (existing) {
        if (existing.reason === reason && existing.userId === userId)
          return existing;
        throw new InventoryError("ALREADY_REVERSED", "Mutasi sudah dibalik");
      }
      return createMovement(tx, {
        itemId: original.itemId,
        barangId: original.barangId,
        batchId: original.batchId,
        fromLocationId: original.toLocationId,
        toLocationId: original.fromLocationId,
        pemakaianMaterialItemId: original.pemakaianMaterialItemId,
        hasilProduksiHarianId: original.hasilProduksiHarianId,
        type: "REVERSAL",
        quantity: Number(original.quantity),
        idempotencyKey: `reverse:${original.id}`,
        sourceType: "REVERSAL",
        sourceId: String(original.id),
        reason,
        userId,
        occurredAt: new Date(),
        reversalOfId: original.id,
        ...(original.groupUuid
          ? { groupUuid: reversalGroupUuid(original.groupUuid) }
          : {}),
      });
    });
  } catch (error) {
    if (isUniqueError(error)) {
      const existing = await prisma.inventoryMovement.findUnique({
        where: { reversalOfId: movementId },
      });
      if (existing?.reason === reason && existing.userId === userId)
        return existing;
      if (existing)
        throw new InventoryError("ALREADY_REVERSED", "Mutasi sudah dibalik");
    }
    throw error;
  }
}

async function createMovement(
  tx: PrismaTransactionClient,
  input: InventoryMovementInput & { reversalOfId?: bigint },
) {
  const locations = [input.fromLocationId, input.toLocationId]
    .filter((id): id is number => id !== undefined && id !== null)
    .sort((a, b) => a - b);
  for (const locationId of locations) {
    await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${locationId} FOR UPDATE`;
  }

  let batchId = input.batchId ?? null;
  if (input.itemId !== undefined && input.itemId !== null) {
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true },
    });
    if (!item)
      throw new InventoryError("ITEM_NOT_FOUND", "Item tidak ditemukan");
  } else {
    await tx.$queryRaw`SELECT id FROM Barang WHERE id = ${input.barangId!} FOR UPDATE`;
    const barang = await tx.barang.findUnique({
      where: { id: input.barangId! },
      select: { id: true, batchId: true },
    });
    if (!barang)
      throw new InventoryError("ITEM_NOT_FOUND", "Barang tidak ditemukan");
    if (batchId !== null && batchId !== barang.batchId) {
      throw new InventoryError(
        "INVALID_MOVEMENT",
        "Batch tidak sesuai dengan barang",
      );
    }
    batchId = barang.batchId;
  }
  if (input.pemakaianMaterialItemId != null) {
    if (input.itemId == null) {
      throw new InventoryError(
        "INVALID_MOVEMENT",
        "Referensi lot hanya dapat dipakai untuk stok item",
      );
    }
    await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${input.pemakaianMaterialItemId} FOR UPDATE`;
    const lot = await tx.pemakaianMaterialItem.findUnique({
      where: { id: input.pemakaianMaterialItemId },
      select: { id: true, itemId: true },
    });
    if (!lot)
      throw new InventoryError("LOT_NOT_FOUND", "Lot WIP tidak ditemukan");
    if (lot.itemId !== input.itemId) {
      throw new InventoryError(
        "INVALID_MOVEMENT",
        "Item tidak sesuai dengan lot WIP",
      );
    }
  }
  const locationRows = await tx.inventoryLocation.findMany({
    where: { id: { in: locations } },
    select: { id: true, isActive: true },
  });
  if (
    locationRows.length !== locations.length ||
    locationRows.some((row) => !row.isActive)
  ) {
    throw new InventoryError(
      "LOCATION_NOT_FOUND",
      "Lokasi tidak ditemukan atau tidak aktif",
    );
  }

  const balanceRows = locations
    .map((locationId) => ({
      locationId,
      balanceKey: makeBalanceKey(input, batchId, locationId),
    }))
    .sort((a, b) => a.balanceKey.localeCompare(b.balanceKey));
  for (const row of balanceRows) {
    const current = await tx.stockBalance.findUnique({
      where: { balanceKey: row.balanceKey },
      select: { id: true },
    });
    if (!current) {
      await tx.stockBalance.create({
        data: {
          balanceKey: row.balanceKey,
          itemId: input.itemId ?? null,
          barangId: input.barangId ?? null,
          batchId,
          pemakaianMaterialItemId: input.pemakaianMaterialItemId ?? null,
          locationId: row.locationId,
          quantity: 0,
        },
      });
    }
    await tx.$queryRaw`SELECT id FROM StockBalance WHERE balanceKey = ${row.balanceKey} FOR UPDATE`;
  }

  if (input.fromLocationId !== undefined && input.fromLocationId !== null) {
    const sourceKey = makeBalanceKey(input, batchId, input.fromLocationId);
    const source = await tx.stockBalance.findUniqueOrThrow({
      where: { balanceKey: sourceKey },
      select: { quantity: true },
    });
    const balance = Number(source.quantity);
    if (balance < input.quantity) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Saldo stok di lokasi ${input.fromLocationId} tidak cukup`,
      );
    }
  }

  const movement = await tx.inventoryMovement.create({
    data: {
      itemId: input.itemId ?? null,
      barangId: input.barangId ?? null,
      batchId,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      pemakaianMaterialItemId: input.pemakaianMaterialItemId ?? null,
      hasilProduksiHarianId: input.hasilProduksiHarianId ?? null,
      produksiHarianId: input.produksiHarianId ?? null,
      type: input.type,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      ...(input.groupUuid
        ? { groupUuid: input.groupUuid }
        : input.fromLocationId != null && input.toLocationId != null
          ? { groupUuid: transferGroupUuid(input.idempotencyKey) }
          : {}),
      ...(input.reversalOfId !== undefined
        ? { reversalOfId: input.reversalOfId }
        : {}),
    },
  });

  for (const row of balanceRows) {
    const delta = row.locationId === input.fromLocationId
      ? -input.quantity
      : input.quantity;
    await tx.stockBalance.update({
      where: { balanceKey: row.balanceKey },
      data: { quantity: { increment: delta } },
    });
  }

  if (input.syncItemStok && input.itemId != null) {
    const oneWay = (input.fromLocationId == null) !== (input.toLocationId == null);
    if (oneWay) {
      await syncItemStok(
        tx,
        input.itemId,
        input.toLocationId != null ? input.quantity : -input.quantity,
      );
    }
  }
  return movement;
}

function makeBalanceKey(
  input: Pick<
    InventoryMovementInput,
    "itemId" | "barangId" | "pemakaianMaterialItemId"
  >,
  batchId: number | null,
  locationId: number,
) {
  const stockKey = input.itemId != null
    ? `I:${input.itemId}`
    : `B:${input.barangId}`;
  const lotId = input.itemId != null ? input.pemakaianMaterialItemId ?? 0 : 0;
  return `${stockKey}:${batchId ?? 0}:${lotId}:${locationId}`;
}

function transferGroupUuid(idempotencyKey: string) {
  return deterministicUuid(`inventory-transfer:${idempotencyKey}`);
}

function reversalGroupUuid(groupUuid: string) {
  return deterministicUuid(`inventory-reversal:${groupUuid}`);
}

function deterministicUuid(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${variant}${hex.slice(17)}`;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function assertSameMovement(
  prior: {
    itemId: number | null;
    barangId: number | null;
    batchId: number | null;
    fromLocationId: number | null;
    toLocationId: number | null;
    type: string;
    quantity: unknown;
    sourceType: string;
    sourceId: string;
  },
  input: InventoryMovementInput,
) {
  const same =
    prior.itemId === (input.itemId ?? null) &&
    prior.barangId === (input.barangId ?? null) &&
    (input.batchId === undefined || prior.batchId === input.batchId) &&
    prior.fromLocationId === (input.fromLocationId ?? null) &&
    prior.toLocationId === (input.toLocationId ?? null) &&
    prior.type === input.type &&
    Number(prior.quantity) === input.quantity &&
    prior.sourceType === input.sourceType &&
    prior.sourceId === input.sourceId;
  if (!same) {
    throw new InventoryError(
      "IDEMPOTENCY_CONFLICT",
      "idempotencyKey sudah dipakai untuk mutasi yang berbeda",
    );
  }
}

function validateMovement(input: InventoryMovementInput) {
  const hasItem = input.itemId !== undefined && input.itemId !== null;
  const hasBarang = input.barangId !== undefined && input.barangId !== null;
  if (hasItem === hasBarang) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "Tentukan tepat satu itemId atau barangId",
    );
  }
  if (
    hasItem &&
    (typeof input.itemId !== "number" ||
      !Number.isSafeInteger(input.itemId) ||
      input.itemId <= 0)
  ) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "itemId harus bilangan bulat positif",
    );
  }
  if (
    hasBarang &&
    (typeof input.barangId !== "number" ||
      !Number.isSafeInteger(input.barangId) ||
      input.barangId <= 0)
  ) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "barangId harus bilangan bulat positif",
    );
  }
  if (hasBarang && input.quantity !== 1) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "Mutasi barang individual harus berjumlah satu",
    );
  }
  const scaledQuantity = input.quantity * 1_000_000;
  if (
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isSafeInteger(Math.round(scaledQuantity)) ||
    Math.abs(scaledQuantity - Math.round(scaledQuantity)) > 1e-7
  ) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "quantity harus positif dengan maksimal 6 angka desimal",
    );
  }
  const from = input.fromLocationId ?? null;
  const to = input.toLocationId ?? null;
  if (
    (from !== null && (!Number.isSafeInteger(from) || from <= 0)) ||
    (to !== null && (!Number.isSafeInteger(to) || to <= 0))
  ) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "ID lokasi harus bilangan bulat positif",
    );
  }
  if ((!from && !to) || (from !== null && from === to)) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "Mutasi harus memiliki lokasi berbeda",
    );
  }
  if (input.type === "OPENING" && (from !== null || to === null)) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "Saldo pembuka harus masuk ke satu lokasi",
    );
  }
  if (
    !input.idempotencyKey.trim() ||
    !input.sourceType.trim() ||
    !input.sourceId.trim()
  ) {
    throw new InventoryError(
      "INVALID_MOVEMENT",
      "Kunci idempotensi dan referensi sumber wajib diisi",
    );
  }
}

function isUniqueError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}
