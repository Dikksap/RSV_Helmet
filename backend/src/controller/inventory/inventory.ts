import type { Request, Response } from "express";
import {
  approveStockAdjustment,
  getDivisionInventoryLocationId,
  getInventoryLocationDetails,
  InventoryError,
  listStockAdjustments,
  rejectStockAdjustment,
  requestStockAdjustment,
} from "../../model/inventory/inventory.js";
import { getBatasDivisi } from "../../lib/divisiScope.js";

const positiveInt = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

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
    );
    return res.json(serialize(adjustment));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function rejectStockAdjustmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
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
