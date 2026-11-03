import type { Request, Response } from "express";
import {
  approveStockAdjustment,
  getDivisionInventoryLocationId,
  getInventoryBalances,
  getInventoryItemSummary,
  getInventoryItemTotals,
  getInventoryLocationDetails,
  InventoryError,
  listInventoryLocations,
  listInventoryMovements,
  listUnmappedLegacyItemBalances,
  listStockAdjustments,
  mapDivisionLocation,
  mapWarehouseLocation,
  postInventoryMovement,
  rejectStockAdjustment,
  requestStockAdjustment,
  setItemDefaultInventoryLocation,
} from "../../model/inventory/inventory.js";
import { getBatasDivisi } from "../../lib/divisiScope.js";

const positiveInt = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (
    value &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof value.toJSON === "function"
  ) {
    return value.toJSON();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serialize(entry)]),
    );
  }
  return value;
}

function respondError(res: Response, error: unknown) {
  if (error instanceof InventoryError) {
    const status = [
      "INSUFFICIENT_STOCK",
      "STALE_ADJUSTMENT",
      "ADJUSTMENT_ALREADY_REVIEWED",
      "NO_DIFFERENCE",
      "IDEMPOTENCY_CONFLICT",
    ].includes(error.code)
      ? 409
      : ["LOCATION_NOT_FOUND", "ITEM_NOT_FOUND", "ADJUSTMENT_NOT_FOUND"].includes(error.code)
        ? 404
        : error.code === "SCOPE_DENIED" || error.code === "ADJUSTMENT_SELF_APPROVAL"
          ? 403
          : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
  return res.status(500).json({
    message: error instanceof Error ? error.message : "Terjadi kesalahan pada inventory",
  });
}

export async function getInventoryLocationsHandler(_req: Request, res: Response) {
  try {
    return res.json(await listInventoryLocations());
  } catch (error) {
    return respondError(res, error);
  }
}

export async function mapWarehouseLocationHandler(req: Request, res: Response) {
  const gudangId = positiveInt(req.body?.gudangId);
  if (!gudangId) return res.status(400).json({ message: "gudangId wajib bilangan bulat positif" });
  try {
    return res.status(201).json(await mapWarehouseLocation(gudangId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function mapDivisionLocationHandler(req: Request, res: Response) {
  const divisiId = positiveInt(req.body?.divisiId);
  if (!divisiId) return res.status(400).json({ message: "divisiId wajib bilangan bulat positif" });
  try {
    return res.status(201).json(await mapDivisionLocation(divisiId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listUnmappedLegacyItemsHandler(_req: Request, res: Response) {
  try {
    return res.json(serialize(await listUnmappedLegacyItemBalances()));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function setItemDefaultLocationHandler(req: Request, res: Response) {
  const itemId = positiveInt(req.params.itemId);
  const locationId = positiveInt(req.body?.locationId);
  if (!itemId || !locationId) {
    return res.status(400).json({ message: "itemId dan locationId harus bilangan bulat positif" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.json(await setItemDefaultInventoryLocation(itemId, locationId, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getInventoryBalancesHandler(req: Request, res: Response) {
  const itemId = req.query.itemId === undefined ? undefined : positiveInt(req.query.itemId) ?? undefined;
  const barangId = req.query.barangId === undefined ? undefined : positiveInt(req.query.barangId) ?? undefined;
  const locationId = req.query.locationId === undefined ? undefined : positiveInt(req.query.locationId) ?? undefined;
  if (req.query.itemId !== undefined && !itemId) {
    return res.status(400).json({ message: "itemId harus bilangan bulat positif" });
  }
  if (req.query.locationId !== undefined && !locationId) {
    return res.status(400).json({ message: "locationId harus bilangan bulat positif" });
  }
  if (req.query.barangId !== undefined && !barangId) {
    return res.status(400).json({ message: "barangId harus bilangan bulat positif" });
  }
  if (itemId && barangId) {
    return res.status(400).json({ message: "Gunakan itemId atau barangId, bukan keduanya" });
  }
  try {
    return res.json(await getInventoryBalances({ itemId, barangId, locationId }));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getInventoryItemSummaryHandler(req: Request, res: Response) {
  const { ids, dari: dariRaw, sampai: sampaiRaw } = (req.body ?? {}) as {
    ids?: unknown;
    dari?: unknown;
    sampai?: unknown;
  };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return res.status(400).json({ message: "ids harus array 1-200 item" });
  }
  const itemIds = ids.map(positiveInt);
  if (itemIds.some((id) => id === null)) {
    return res.status(400).json({ message: "ids harus berisi angka bulat positif" });
  }
  const from = dariRaw === undefined || dariRaw === "" ? undefined : parseDateOnly(dariRaw);
  const untilDate = sampaiRaw === undefined || sampaiRaw === "" ? undefined : parseDateOnly(sampaiRaw);
  if (dariRaw !== undefined && dariRaw !== "" && !from) {
    return res.status(400).json({ message: "dari harus tanggal valid (YYYY-MM-DD)" });
  }
  if (sampaiRaw !== undefined && sampaiRaw !== "" && !untilDate) {
    return res.status(400).json({ message: "sampai harus tanggal valid (YYYY-MM-DD)" });
  }
  if (from && untilDate && from > untilDate) {
    return res.status(400).json({ message: "dari tidak boleh melebihi sampai" });
  }
  const until = untilDate ? new Date(untilDate) : undefined;
  until?.setUTCDate(until.getUTCDate() + 1);
  try {
    return res.json({
      ringkasan: await getInventoryItemSummary(itemIds as number[], { from, until }),
    });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getInventoryItemTotalsHandler(req: Request, res: Response) {
  const { ids } = (req.body ?? {}) as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return res.status(400).json({ message: "ids harus array 1-200 item" });
  }
  const itemIds = ids.map(positiveInt);
  if (itemIds.some((id) => id === null)) {
    return res.status(400).json({ message: "ids harus berisi angka bulat positif" });
  }
  try {
    return res.json({ stok: await getInventoryItemTotals(itemIds as number[]) });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getInventoryMovementsHandler(req: Request, res: Response) {
  const itemId = req.query.itemId === undefined ? undefined : positiveInt(req.query.itemId) ?? undefined;
  const barangId = req.query.barangId === undefined ? undefined : positiveInt(req.query.barangId) ?? undefined;
  const locationId = req.query.locationId === undefined ? undefined : positiveInt(req.query.locationId) ?? undefined;
  const take = req.query.take === undefined ? 100 : positiveInt(req.query.take);
  if (req.query.itemId !== undefined && !itemId) {
    return res.status(400).json({ message: "itemId harus bilangan bulat positif" });
  }
  if (req.query.locationId !== undefined && !locationId) {
    return res.status(400).json({ message: "locationId harus bilangan bulat positif" });
  }
  if (req.query.barangId !== undefined && !barangId) {
    return res.status(400).json({ message: "barangId harus bilangan bulat positif" });
  }
  if (itemId && barangId) {
    return res.status(400).json({ message: "Gunakan itemId atau barangId, bukan keduanya" });
  }
  if (!take || take > 500) return res.status(400).json({ message: "take harus 1 sampai 500" });
  try {
    return res.json(serialize(await listInventoryMovements({ itemId, barangId, locationId, take })));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function postInventoryMovementHandler(req: Request, res: Response) {
  const itemId = req.body?.itemId == null ? null : positiveInt(req.body.itemId);
  const barangId = req.body?.barangId == null ? null : positiveInt(req.body.barangId);
  const fromLocationId = req.body?.fromLocationId == null ? null : positiveInt(req.body.fromLocationId);
  const toLocationId = req.body?.toLocationId == null ? null : positiveInt(req.body.toLocationId);
  const quantityInput = req.body?.quantity;
  const quantity = typeof quantityInput === "number" ||
    (typeof quantityInput === "string" && quantityInput.trim() !== "")
    ? Number(quantityInput)
    : Number.NaN;
  const key = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const occurredAtRaw = req.body?.occurredAt;
  const occurredAt = typeof occurredAtRaw === "string" ? new Date(occurredAtRaw) : undefined;
  const userId = req.user?.id;
  if (req.body?.itemId != null && !itemId) {
    return res.status(400).json({ message: "itemId harus bilangan bulat positif" });
  }
  if (req.body?.barangId != null && !barangId) {
    return res.status(400).json({ message: "barangId harus bilangan bulat positif" });
  }
  if ((req.body?.itemId != null) === (req.body?.barangId != null)) {
    return res.status(400).json({ message: "Tentukan tepat satu itemId atau barangId" });
  }
  if (barangId !== null) {
    return res.status(400).json({ message: "Mutasi barang individual hanya melalui workflow QC/shipment" });
  }
  if (req.body?.fromLocationId != null && !fromLocationId) {
    return res.status(400).json({ message: "fromLocationId harus bilangan bulat positif" });
  }
  if (req.body?.toLocationId != null && !toLocationId) {
    return res.status(400).json({ message: "toLocationId harus bilangan bulat positif" });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "quantity harus lebih besar dari nol" });
  }
  if (key.length < 8 || key.length > 191) {
    return res.status(400).json({ message: "idempotencyKey wajib 8 sampai 191 karakter" });
  }
  if (!reason) return res.status(400).json({ message: "reason wajib diisi" });
  if (occurredAtRaw !== undefined && (!occurredAt || Number.isNaN(occurredAt.getTime()))) {
    return res.status(400).json({ message: "occurredAt harus tanggal valid" });
  }
  if (!userId || !req.access) return res.status(401).json({ message: "Token tidak ditemukan" });
  const requiredPermission = fromLocationId && toLocationId
    ? "INVENTORY_MOVE"
    : "INVENTORY_ADJUST";
  if (!req.access.permissions.includes(requiredPermission)) {
    return res.status(403).json({ message: `Memerlukan permission ${requiredPermission}` });
  }
  try {
    const movement = await postInventoryMovement({
      itemId,
      barangId,
      fromLocationId,
      toLocationId,
      quantity,
      type: fromLocationId && toLocationId ? "TRANSFER" : toLocationId ? "OPENING" : "ADJUSTMENT",
      idempotencyKey: key,
      sourceType: fromLocationId && toLocationId ? "MANUAL_TRANSFER" : toLocationId ? "MANUAL_OPENING" : "MANUAL_ADJUSTMENT",
      sourceId: key,
      reason,
      userId,
      syncItemStok: true,
      ...(occurredAt ? { occurredAt } : {}),
    });
    return res.status(201).json(serialize(movement));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listStockAdjustmentsHandler(req: Request, res: Response) {
  const rawStatus = req.query.status;
  const status =
    rawStatus === "PENDING" || rawStatus === "APPROVED" || rawStatus === "REJECTED"
      ? rawStatus
      : undefined;
  if (rawStatus !== undefined && status === undefined) {
    return res.status(400).json({ message: "status adjustment tidak valid" });
  }
  const access = req.access;
  if (!access) return res.status(401).json({ message: "Token tidak ditemukan" });
  const canApprove = access.permissions.includes("INVENTORY_ADJUST_APPROVE");
  const divisiId = access.role === "admin" ? undefined : access.divisiId ?? undefined;
  const warehouseOnly =
    divisiId === undefined &&
    access.role !== "admin" &&
    !canApprove &&
    access.role === "gudang";
  if (divisiId === undefined && access.role !== "admin" && !canApprove && !warehouseOnly) {
    return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
  }
  try {
    return res.json(
      serialize(await listStockAdjustments({ divisiId, warehouseOnly, status })),
    );
  } catch (error) {
    return respondError(res, error);
  }
}

export async function requestStockAdjustmentHandler(req: Request, res: Response) {
  const itemId = positiveInt(req.body?.itemId);
  const locationId = positiveInt(req.body?.locationId);
  const batchId = req.body?.batchId == null ? null : positiveInt(req.body.batchId);
  const physicalQuantity =
    typeof req.body?.physicalQuantity === "number" ||
    (typeof req.body?.physicalQuantity === "string" &&
      req.body.physicalQuantity.trim() !== "")
      ? Number(req.body.physicalQuantity)
      : Number.NaN;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!itemId || !locationId) {
    return res.status(400).json({ message: "itemId dan locationId harus bilangan bulat positif" });
  }
  if (req.body?.batchId != null && !batchId) {
    return res.status(400).json({ message: "batchId harus bilangan bulat positif" });
  }
  if (
    !Number.isFinite(physicalQuantity) ||
    physicalQuantity < 0 ||
    !Number.isSafeInteger(physicalQuantity * 1_000_000)
  ) {
    return res.status(400).json({
      message: "physicalQuantity harus >= 0 dengan maksimal 6 angka desimal",
    });
  }
  if (reason.length < 5) return res.status(400).json({ message: "reason minimal 5 karakter" });
  if (!req.user?.id || !req.access) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }
  try {
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      const location = await getInventoryLocationDetails(locationId);
      const ownDivisionLocationId = batas.divisiId
        ? await getDivisionInventoryLocationId(batas.divisiId)
        : null;
      const warehouseAllowed =
        req.access.role === "gudang" && location?.type === "WAREHOUSE";
      if (!location?.isActive || (!warehouseAllowed && ownDivisionLocationId !== locationId)) {
        return res.status(403).json({ message: "Lokasi adjustment di luar cakupan akun" });
      }
    }
    return res.status(201).json(serialize(await requestStockAdjustment({
      itemId,
      locationId,
      batchId,
      physicalQuantity,
      reason,
      requestedById: req.user.id,
    })));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function approveStockAdjustmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "id adjustment tidak valid" });
  if (!req.user?.id || !req.access) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }
  const batas = getBatasDivisi(req.access);
  try {
    const adjustment = await approveStockAdjustment(
      id,
      req.user.id,
      batas.admin ? undefined : batas.divisiId ?? undefined,
      req.access.role === "admin",
    );
    return res.json(serialize(adjustment));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function rejectStockAdjustmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  const reasonInput = req.body?.reviewNotes ?? req.body?.reason;
  const reason = typeof reasonInput === "string" ? reasonInput.trim() : "";
  if (!id) return res.status(400).json({ message: "id adjustment tidak valid" });
  if (reason.length < 5) return res.status(400).json({ message: "reason minimal 5 karakter" });
  if (!req.user?.id || !req.access) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }
  const batas = getBatasDivisi(req.access);
  try {
    const adjustment = await rejectStockAdjustment(
      id,
      req.user.id,
      reason,
      batas.admin ? undefined : batas.divisiId ?? undefined,
    );
    return res.json(serialize(adjustment));
  } catch (error) {
    return respondError(res, error);
  }
}
