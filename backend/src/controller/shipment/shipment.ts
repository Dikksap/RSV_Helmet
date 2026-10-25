import type { Request, Response } from "express";
import {
  cancelCustomerShipment,
  createCustomerShipment,
  getCustomerShipment,
  listAvailableFinishedGoods,
  listCustomerShipments,
  listFinishedGoodsReceiptCandidates,
  postCustomerShipment,
  receiveFinishedGoods,
  receiveShipmentReturn,
  ShipmentError,
} from "../../model/shipment/shipment.js";
import { InventoryError } from "../../model/inventory/inventory.js";

function positiveInt(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function respondError(res: Response, error: unknown) {
  if (error instanceof ShipmentError || error instanceof InventoryError) {
    const code = error.code;
    const status = code.includes("NOT_FOUND") ? 404
      : code.includes("CONFLICT") || code.includes("STATE") || code.includes("AVAILABLE") ||
        code.includes("ALLOWED") || code.includes("SHORT")
        ? 409
        : 400;
    return res.status(status).json({ code, message: error.message });
  }
  return res.status(500).json({
    message: error instanceof Error ? error.message : "Terjadi kesalahan pada workflow shipment",
  });
}

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.map(positiveInt);
  return ids.every((id): id is number => id !== null) ? ids : null;
}

export async function listCustomerShipmentsHandler(req: Request, res: Response) {
  const take = req.query.take === undefined ? 100 : positiveInt(req.query.take);
  if (!take || take > 500) return res.status(400).json({ message: "take harus 1 sampai 500" });
  try {
    return res.json(await listCustomerShipments(take));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listFinishedGoodsReceiptCandidatesHandler(_req: Request, res: Response) {
  try {
    return res.json(await listFinishedGoodsReceiptCandidates());
  } catch (error) {
    return respondError(res, error);
  }
}

export async function listAvailableFinishedGoodsHandler(req: Request, res: Response) {
  const locationId = positiveInt(req.query.locationId);
  if (!locationId) return res.status(400).json({ message: "Pilih lokasi gudang aktif" });
  try {
    return res.json(await listAvailableFinishedGoods(locationId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getCustomerShipmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "id shipment tidak valid" });
  try {
    return res.json(await getCustomerShipment(id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function createCustomerShipmentHandler(req: Request, res: Response) {
  const fromLocationId = positiveInt(req.body?.fromLocationId);
  const barangIds = parseIds(req.body?.barangIds);
  const { recipientName, recipientAddress, reference, idempotencyKey } = req.body ?? {};
  if (
    !fromLocationId ||
    !barangIds?.length ||
    typeof recipientName !== "string" ||
    typeof recipientAddress !== "string" ||
    typeof idempotencyKey !== "string" ||
    (reference != null && typeof reference !== "string")
  ) {
    return res.status(400).json({ message: "Data draft shipment tidak valid" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.status(201).json(await createCustomerShipment({
      fromLocationId,
      recipientName,
      recipientAddress,
      reference,
      idempotencyKey,
      barangIds,
    }, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function postCustomerShipmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "id shipment tidak valid" });
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.json(await postCustomerShipment(id, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function cancelCustomerShipmentHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!id) return res.status(400).json({ message: "id shipment tidak valid" });
  if (reason.length < 5) return res.status(400).json({ message: "reason minimal 5 karakter" });
  try {
    return res.json(await cancelCustomerShipment(id, reason));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function receiveFinishedGoodsHandler(req: Request, res: Response) {
  const qualityInspectionLineId = positiveInt(req.body?.qualityInspectionLineId);
  const locationId = positiveInt(req.body?.locationId);
  const barangIds = parseIds(req.body?.barangIds);
  const idempotencyKey = req.body?.idempotencyKey;
  if (!qualityInspectionLineId || !locationId || !barangIds?.length || typeof idempotencyKey !== "string") {
    return res.status(400).json({ message: "Data penerimaan Finish Good tidak valid" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.status(201).json(await receiveFinishedGoods({
      qualityInspectionLineId,
      locationId,
      idempotencyKey,
      barangIds,
    }, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function receiveShipmentReturnHandler(req: Request, res: Response) {
  const shipmentId = positiveInt(req.body?.shipmentId);
  const toLocationId = positiveInt(req.body?.toLocationId);
  const idempotencyKey = req.body?.idempotencyKey;
  const reason = req.body?.reason;
  const rows = req.body?.lines;
  if (
    !shipmentId || !toLocationId || typeof idempotencyKey !== "string" ||
    typeof reason !== "string" || !Array.isArray(rows) || rows.length === 0
  ) {
    return res.status(400).json({ message: "Data penerimaan retur tidak valid" });
  }
  const lines: Array<{ shipmentLineId: number; condition: string }> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return res.status(400).json({ message: "Baris retur tidak valid" });
    const shipmentLineId = positiveInt(row.shipmentLineId);
    if (!shipmentLineId || typeof row.condition !== "string") {
      return res.status(400).json({ message: "Baris retur tidak valid" });
    }
    lines.push({ shipmentLineId, condition: row.condition });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    return res.status(201).json(await receiveShipmentReturn({
      shipmentId,
      toLocationId,
      idempotencyKey,
      reason,
      lines,
    }, req.user.id));
  } catch (error) {
    return respondError(res, error);
  }
}
