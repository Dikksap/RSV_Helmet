import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

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
      | "ALREADY_REVERSED",
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
    throw new InventoryError("LOCATION_NOT_FOUND", `Lokasi divisi ${division.nama} tidak aktif`);
  }
  return location;
}

export async function listInventoryLocations() {
  return prisma.inventoryLocation.findMany({
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
  if (!warehouse) throw new InventoryError("LOCATION_NOT_FOUND", "Gudang tidak ditemukan");
  return mapLocation("WAREHOUSE", warehouse, `WH-${gudangId}`);
}

export async function mapDivisionLocation(divisiId: number) {
  const division = await prisma.divisi.findUnique({
    where: { id: divisiId },
    select: { id: true, nama: true },
  });
  if (!division) throw new InventoryError("LOCATION_NOT_FOUND", "Divisi tidak ditemukan");
  return mapLocation(
    "DIVISION",
    { id: division.id, name: division.nama, isActive: true },
    `DIV-${divisiId}`,
  );
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
  const unique = type === "WAREHOUSE" ? { gudangId: owner.id } : { divisiId: owner.id };
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
  take: number;
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.barangId ? { barangId: filters.barangId } : {}),
      ...(filters.locationId
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
      fromLocation: { select: { id: true, code: true, name: true, type: true } },
      toLocation: { select: { id: true, code: true, name: true, type: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: filters.take,
  });
}

export async function getInventoryBalances(filters: {
  itemId?: number;
  barangId?: number;
  locationId?: number;
}) {
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.barangId ? { barangId: filters.barangId } : {}),
      ...(filters.locationId
        ? {
            OR: [
              { fromLocationId: filters.locationId },
              { toLocationId: filters.locationId },
            ],
          }
        : {}),
    },
    select: {
      itemId: true,
      barangId: true,
      quantity: true,
      fromLocationId: true,
      toLocationId: true,
    },
  });
  const balances = new Map<string, number>();
  for (const movement of movements) {
    const stockKey = movement.itemId !== null
      ? `I:${movement.itemId}`
      : movement.barangId !== null ? `B:${movement.barangId}` : null;
    if (stockKey === null) continue;
    const quantity = Number(movement.quantity);
    if (movement.fromLocationId !== null) {
      const key = `${stockKey}:${movement.fromLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) - quantity);
    }
    if (movement.toLocationId !== null) {
      const key = `${stockKey}:${movement.toLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) + quantity);
    }
  }
  const rows = [...balances.entries()]
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
  return rows.filter((row) =>
    (filters.itemId === undefined || row.itemId === filters.itemId) &&
    (filters.barangId === undefined || row.barangId === filters.barangId) &&
    (filters.locationId === undefined || row.locationId === filters.locationId),
  );
}

export type InventoryMovementInput = {
  itemId?: number | null;
  barangId?: number | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  pemakaianMaterialItemId?: number | null;
  hasilProduksiHarianId?: number | null;
  type: "OPENING" | "PRODUCTION" | "TRANSFER" | "QC" | "REPAIR" | "SHIPMENT" | "RETURN" | "ADJUSTMENT" | "REVERSAL";
  quantity: number;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  reason?: string | null;
  userId?: number | null;
  occurredAt?: Date;
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
) {
  try {
    return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.$queryRaw`SELECT id FROM InventoryMovement WHERE id = ${movementId} FOR UPDATE`;
      const original = await tx.inventoryMovement.findUnique({ where: { id: movementId } });
      if (!original) throw new InventoryError("MOVEMENT_NOT_FOUND", "Mutasi tidak ditemukan");
      const existing = await tx.inventoryMovement.findUnique({
        where: { reversalOfId: original.id },
      });
      if (existing) {
        if (existing.reason === reason && existing.userId === userId) return existing;
        throw new InventoryError("ALREADY_REVERSED", "Mutasi sudah dibalik");
      }
      return createMovement(tx, {
        itemId: original.itemId,
        barangId: original.barangId,
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
      });
    });
  } catch (error) {
    if (isUniqueError(error)) {
      const existing = await prisma.inventoryMovement.findUnique({
        where: { reversalOfId: movementId },
      });
      if (existing?.reason === reason && existing.userId === userId) return existing;
      if (existing) throw new InventoryError("ALREADY_REVERSED", "Mutasi sudah dibalik");
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

  if (input.itemId !== undefined && input.itemId !== null) {
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true },
    });
    if (!item) throw new InventoryError("ITEM_NOT_FOUND", "Item tidak ditemukan");
  } else {
    await tx.$queryRaw`SELECT id FROM Barang WHERE id = ${input.barangId!} FOR UPDATE`;
    const barang = await tx.barang.findUnique({
      where: { id: input.barangId! },
      select: { id: true },
    });
    if (!barang) throw new InventoryError("ITEM_NOT_FOUND", "Barang tidak ditemukan");
  }
  if (input.pemakaianMaterialItemId != null) {
    if (input.itemId == null) {
      throw new InventoryError("INVALID_MOVEMENT", "Referensi lot hanya dapat dipakai untuk stok item");
    }
    await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${input.pemakaianMaterialItemId} FOR UPDATE`;
    const lot = await tx.pemakaianMaterialItem.findUnique({
      where: { id: input.pemakaianMaterialItemId },
      select: { id: true, itemId: true },
    });
    if (!lot) throw new InventoryError("LOT_NOT_FOUND", "Lot WIP tidak ditemukan");
    if (lot.itemId !== input.itemId) {
      throw new InventoryError("INVALID_MOVEMENT", "Item tidak sesuai dengan lot WIP");
    }
  }
  const locationRows = await tx.inventoryLocation.findMany({
    where: { id: { in: locations } },
    select: { id: true, isActive: true },
  });
  if (locationRows.length !== locations.length || locationRows.some((row) => !row.isActive)) {
    throw new InventoryError("LOCATION_NOT_FOUND", "Lokasi tidak ditemukan atau tidak aktif");
  }

  if (input.fromLocationId !== undefined && input.fromLocationId !== null) {
    const balance = await getBalanceInTransaction(tx, input, input.fromLocationId);
    if (balance < input.quantity) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Saldo stok di lokasi ${input.fromLocationId} tidak cukup`,
      );
    }
  }

  return tx.inventoryMovement.create({
    data: {
      itemId: input.itemId ?? null,
      barangId: input.barangId ?? null,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      pemakaianMaterialItemId: input.pemakaianMaterialItemId ?? null,
      hasilProduksiHarianId: input.hasilProduksiHarianId ?? null,
      type: input.type,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      ...(input.reversalOfId !== undefined ? { reversalOfId: input.reversalOfId } : {}),
    },
  });
}

async function getBalanceInTransaction(
  tx: PrismaTransactionClient,
  stock: Pick<InventoryMovementInput, "itemId" | "barangId" | "pemakaianMaterialItemId">,
  locationId: number,
) {
  const movements = await tx.inventoryMovement.findMany({
    where: {
      ...(stock.itemId != null ? { itemId: stock.itemId } : { barangId: stock.barangId! }),
      ...(stock.pemakaianMaterialItemId != null
        ? { pemakaianMaterialItemId: stock.pemakaianMaterialItemId }
        : {}),
      OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
    },
    select: { quantity: true, fromLocationId: true, toLocationId: true },
  });
  return movements.reduce((balance, movement) => {
    const quantity = Number(movement.quantity);
    if (movement.fromLocationId === locationId) return balance - quantity;
    if (movement.toLocationId === locationId) return balance + quantity;
    return balance;
  }, 0);
}

function validateMovement(input: InventoryMovementInput) {
  const hasItem = input.itemId !== undefined && input.itemId !== null;
  const hasBarang = input.barangId !== undefined && input.barangId !== null;
  if (hasItem === hasBarang) {
    throw new InventoryError("INVALID_MOVEMENT", "Tentukan tepat satu itemId atau barangId");
  }
  if (hasItem && (typeof input.itemId !== "number" || !Number.isSafeInteger(input.itemId) || input.itemId <= 0)) {
    throw new InventoryError("INVALID_MOVEMENT", "itemId harus bilangan bulat positif");
  }
  if (hasBarang && (typeof input.barangId !== "number" || !Number.isSafeInteger(input.barangId) || input.barangId <= 0)) {
    throw new InventoryError("INVALID_MOVEMENT", "barangId harus bilangan bulat positif");
  }
  if (hasBarang && input.quantity !== 1) {
    throw new InventoryError("INVALID_MOVEMENT", "Mutasi barang individual harus berjumlah satu");
  }
  const scaledQuantity = input.quantity * 1_000_000;
  if (
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isSafeInteger(Math.round(scaledQuantity)) ||
    Math.abs(scaledQuantity - Math.round(scaledQuantity)) > 1e-7
  ) {
    throw new InventoryError("INVALID_MOVEMENT", "quantity harus positif dengan maksimal 6 angka desimal");
  }
  const from = input.fromLocationId ?? null;
  const to = input.toLocationId ?? null;
  if (
    (from !== null && (!Number.isSafeInteger(from) || from <= 0)) ||
    (to !== null && (!Number.isSafeInteger(to) || to <= 0))
  ) {
    throw new InventoryError("INVALID_MOVEMENT", "ID lokasi harus bilangan bulat positif");
  }
  if ((!from && !to) || (from !== null && from === to)) {
    throw new InventoryError("INVALID_MOVEMENT", "Mutasi harus memiliki lokasi berbeda");
  }
  if (input.type === "OPENING" && (from !== null || to === null)) {
    throw new InventoryError("INVALID_MOVEMENT", "Saldo pembuka harus masuk ke satu lokasi");
  }
  if (input.type === "TRANSFER" && ((from === null) === (to === null))) {
    throw new InventoryError("INVALID_MOVEMENT", "Transfer harus berupa satu sisi transfer atau perpindahan langsung");
  }
  if (!input.idempotencyKey.trim() || !input.sourceType.trim() || !input.sourceId.trim()) {
    throw new InventoryError("INVALID_MOVEMENT", "Kunci idempotensi dan referensi sumber wajib diisi");
  }
}

function assertSameMovement(
  prior: {
    itemId: number | null;
    barangId: number | null;
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

function isUniqueError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}
