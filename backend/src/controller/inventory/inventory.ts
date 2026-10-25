import type { Request, Response } from "express";
import {
  getInventoryBalances,
  InventoryError,
  listInventoryLocations,
  listInventoryMovements,
  mapDivisionLocation,
  mapWarehouseLocation,
  postInventoryMovement,
  reverseInventoryMovement,
} from "../../model/inventory/inventory.js";

const positiveInt = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object" && "toJSON" in value && typeof value.toJSON === "function") {
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
    const status = error.code === "INSUFFICIENT_STOCK" ? 409
      : error.code === "LOCATION_NOT_FOUND" || error.code === "ITEM_NOT_FOUND" ? 404
      : error.code === "IDEMPOTENCY_CONFLICT" || error.code === "ALREADY_REVERSED" ? 409
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
  if (barangId && quantity !== 1) {
    return res.status(400).json({ message: "Mutasi barang individual harus berjumlah satu" });
  }
  if (key.length < 8 || key.length > 191) {
    return res.status(400).json({ message: "idempotencyKey wajib 8 sampai 191 karakter" });
  }
  if (!reason) return res.status(400).json({ message: "reason wajib diisi" });
  if (!userId) return res.status(401).json({ message: "Token tidak ditemukan" });
  const requiredPermission = fromLocationId && toLocationId
    ? "INVENTORY_MOVE"
    : "INVENTORY_ADJUST";
  if (!req.access?.permissions.includes(requiredPermission)) {
    return res.status(403).json({ message: `Memerlukan permission ${requiredPermission}` });
  }
  try {
    const movement = await postInventoryMovement({
      itemId,
      barangId,
      fromLocationId,
      toLocationId,
      quantity,
      type: fromLocationId && toLocationId ? "TRANSFER"
        : toLocationId ? "OPENING" : "ADJUSTMENT",
      idempotencyKey: key,
      sourceType: fromLocationId && toLocationId ? "MANUAL_TRANSFER"
        : toLocationId ? "MANUAL_OPENING" : "MANUAL_ADJUSTMENT",
      sourceId: key,
      reason,
      userId,
    });
    return res.status(201).json(serialize(movement));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function reverseInventoryMovementHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!id) return res.status(400).json({ message: "id mutasi tidak valid" });
  if (reason.length < 5) return res.status(400).json({ message: "reason minimal 5 karakter" });
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    const movement = await reverseInventoryMovement(BigInt(id), req.user.id, reason);
    return res.status(201).json(serialize(movement));
  } catch (error) {
    return respondError(res, error);
  }
}
