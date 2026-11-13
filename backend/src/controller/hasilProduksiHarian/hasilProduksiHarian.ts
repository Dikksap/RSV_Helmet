import type { Request, Response } from "express";
import {
  createHasilProduksi,
  getHasilProduksiById,
  listHasilProduksi,
  HasilProduksiError,
  WipKurangError,
  INPUT_TIDAK_VALID,
  IDEMPOTENCY_CONFLICT,
} from "../../model/hasilProduksiHarian/hasilProduksiHarian.js";
import { BomError } from "../../model/bom/resolver.js";
import { InventoryError } from "../../model/inventory/inventory.js";
import { StokKurangError } from "../../model/stokItem/stokItem.js";
import { parseTanggalBisnis } from "../../lib/tanggalBisnis.js";
import type { TipeHasilProduksiItem } from "../../../generated/prisma/enums.js";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function textOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function parseItems(raw: unknown):
  | { ok: true; items: Array<{ itemId?: number | null; productVariantId?: number | null; tipe: TipeHasilProduksiItem; jumlah: number; keterangan?: string | null }> }
  | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, message: "Field 'items' wajib diisi minimal 1 baris" };
  }
  const items = [];
  for (const [index, row] of raw.entries()) {
    if (!row || typeof row !== "object") {
      return { ok: false, message: `items[${index}] harus objek` };
    }
    const item = row as Record<string, unknown>;
    const tipe = String(item.tipe ?? "").trim().toUpperCase();
    if (tipe !== "MASUK" && tipe !== "KELUAR" && tipe !== "HASIL") {
      return { ok: false, message: `items[${index}].tipe harus MASUK, KELUAR, atau HASIL` };
    }
    const productVariantId =
      item.productVariantId === undefined || item.productVariantId === null || item.productVariantId === ""
        ? null
        : positiveInt(item.productVariantId);
    if (
      item.productVariantId !== undefined &&
      item.productVariantId !== null &&
      item.productVariantId !== "" &&
      !productVariantId
    ) {
      return { ok: false, message: `items[${index}].productVariantId harus angka bulat positif` };
    }
    const itemId = positiveInt(item.itemId);
    if (!itemId && !(tipe === "HASIL" && productVariantId)) {
      return { ok: false, message: `items[${index}].itemId wajib angka bulat positif` };
    }
    const jumlah = Number(item.jumlah);
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      return { ok: false, message: `items[${index}].jumlah harus bilangan bulat lebih dari 0` };
    }
    items.push({
      ...(itemId ? { itemId } : {}),
      ...(productVariantId ? { productVariantId } : {}),
      tipe: tipe as TipeHasilProduksiItem,
      jumlah,
      keterangan: textOrNull(item.keterangan),
    });
  }
  return { ok: true, items };
}

function respondError(res: Response, error: unknown) {
  if (error instanceof WipKurangError) {
    return res.status(409).json({
      code: error.code,
      message: error.message,
      dataKekurangan: error.dataKekurangan,
      saranTransfer: error.saranTransfer,
      permintaanBarang: error.permintaanBarang,
      permintaanError: error.permintaanError,
    });
  }
  if (error instanceof BomError) {
    return res.status(error.code === "BOM_AMBIGU" || error.code === "BOM_SIKLIKUS" ? 409 : 400).json({
      code: error.code,
      message: error.message,
    });
  }
  if (error instanceof HasilProduksiError) {
    const status =
      error.code === IDEMPOTENCY_CONFLICT
        ? 409
        : error.code === "DIVISI_TIDAK_DITEMUKAN" || error.code === "ITEM_TIDAK_DITEMUKAN"
          ? 404
          : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
  if (error instanceof StokKurangError) {
    return res.status(409).json({
      code: error.code,
      message: `Stok item ${error.itemId} tidak cukup (tersedia ${error.tersedia})`,
      tersedia: error.tersedia,
    });
  }
  if (error instanceof InventoryError) {
    const status =
      error.code === "INSUFFICIENT_STOCK" || error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : "Gagal memproses hasil produksi";
  return res.status(500).json({ message });
}

export async function createHasilProduksiHandler(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });
  const body = (req.body ?? {}) as Record<string, unknown>;

  const divisiId = positiveInt(body.divisiId);
  if (!divisiId) return res.status(400).json({ message: "Field 'divisiId' wajib angka bulat positif" });

  const scopeDivisi = req.access?.role === "admin" ? null : req.access?.divisiId ?? null;
  if (scopeDivisi !== null && scopeDivisi !== divisiId) {
    return res.status(403).json({ message: "Divisi hasil produksi di luar scope akun" });
  }

  const idempotencyKey = textOrNull(body.idempotencyKey);
  if (!idempotencyKey) {
    return res.status(400).json({ message: "Field 'idempotencyKey' wajib diisi" });
  }

  const parsedItems = parseItems(body.items);
  if (!parsedItems.ok) return res.status(400).json({ message: parsedItems.message });

  let tanggalProduksi: Date | null = null;
  if (body.tanggalProduksi !== undefined && body.tanggalProduksi !== null && body.tanggalProduksi !== "") {
    tanggalProduksi = parseTanggalBisnis(body.tanggalProduksi);
    if (!tanggalProduksi) {
      return res.status(400).json({ message: "Field 'tanggalProduksi' harus tanggal valid" });
    }
  }

  const productionWorkOrderId =
    body.productionWorkOrderId === undefined || body.productionWorkOrderId === null
      ? undefined
      : positiveInt(body.productionWorkOrderId) ?? undefined;
  const routingStageId =
    body.routingStageId === undefined || body.routingStageId === null
      ? undefined
      : positiveInt(body.routingStageId) ?? undefined;
  const bomId =
    body.bomId === undefined || body.bomId === null ? undefined : positiveInt(body.bomId) ?? undefined;

  try {
    const result = await createHasilProduksi(
      {
        divisiId,
        tanggalProduksi,
        ...(productionWorkOrderId !== undefined ? { productionWorkOrderId } : {}),
        ...(routingStageId !== undefined ? { routingStageId } : {}),
        ...(bomId !== undefined ? { bomId } : {}),
        idempotencyKey,
        keterangan: textOrNull(body.keterangan),
        items: parsedItems.items,
      },
      req.user.id,
    );
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof HasilProduksiError && error.code === INPUT_TIDAK_VALID) {
      return res.status(400).json({ code: error.code, message: error.message });
    }
    return respondError(res, error);
  }
}

export async function listHasilProduksiHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const divisiId = req.query.divisiId !== undefined ? positiveInt(req.query.divisiId) : null;
  if (req.query.divisiId !== undefined && !divisiId) {
    return res.status(400).json({ message: "Query 'divisiId' harus angka bulat positif" });
  }
  const scopeDivisi = req.access?.role === "admin" ? null : req.access?.divisiId ?? null;
  if (scopeDivisi !== null && divisiId !== null && scopeDivisi !== divisiId) {
    return res.status(403).json({ message: "Divisi di luar scope akun" });
  }
  let dari: Date | undefined;
  let sampai: Date | undefined;
  if (req.query.dari !== undefined && req.query.dari !== "") {
    const parsed = parseTanggalBisnis(req.query.dari);
    if (!parsed) return res.status(400).json({ message: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" });
    dari = parsed;
  }
  if (req.query.sampai !== undefined && req.query.sampai !== "") {
    const parsed = parseTanggalBisnis(req.query.sampai);
    if (!parsed) return res.status(400).json({ message: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" });
    sampai = parsed;
  }
  if (dari && sampai && dari > sampai) {
    return res.status(400).json({ message: "Query 'dari' tidak boleh melebihi 'sampai'" });
  }
  try {
    return res.json(
      await listHasilProduksi({
        page,
        limit,
        ...(divisiId !== null ? { divisiId } : scopeDivisi !== null ? { divisiId: scopeDivisi } : {}),
        ...(dari ? { dari } : {}),
        ...(sampai ? { sampai } : {}),
      }),
    );
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getHasilProduksiHandler(req: Request, res: Response) {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Parameter 'id' tidak valid" });
  try {
    const row = await getHasilProduksiById(id);
    if (!row) return res.status(404).json({ message: "Transaksi hasil produksi tidak ditemukan" });
    const scopeDivisi = req.access?.role === "admin" ? null : req.access?.divisiId ?? null;
    if (scopeDivisi !== null && row.divisiId !== scopeDivisi) {
      return res.status(403).json({ message: "Transaksi di luar scope akun" });
    }
    return res.json(row);
  } catch (error) {
    return respondError(res, error);
  }
}
