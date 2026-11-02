import type { Request, Response } from "express";
import {
  createPenerimaan,
  createProduksi,
  getBomPreview,
  getProduksiById,
  getProduksiOptions,
  listLokasi,
  listProduksi,
  listStokGudang,
  ProduksiHarianError,
} from "../../model/produksiHarian/produksiHarian.js";
import { InventoryError } from "../../model/inventory/inventory.js";

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseQuantity(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && Number.isSafeInteger(number * 1_000_000)
    ? number
    : null;
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
  if (error instanceof ProduksiHarianError || error instanceof InventoryError) {
    const status =
      error.code === "STOK_TIDAK_CUKUP" || error.code === "INSUFFICIENT_STOCK"
        ? 409
        : error.code === "GUDANG_JENIS_TIDAK_DIIZINKAN"
          ? 409
          : ["ITEM_TIDAK_DITEMUKAN", "DIVISI_TIDAK_DITEMUKAN", "LOKASI_TIDAK_DITEMUKAN"].includes(error.code)
            ? 404
            : 400;
    return res.status(status).json({ code: error.code, message: error.message });
  }
  return res.status(500).json({
    message: error instanceof Error ? error.message : "Terjadi kesalahan pada produksi harian",
  });
}

function scopeDivision(req: Request, res: Response, divisiId: number | null): boolean {
  const access = req.access;
  if (!access) {
    res.status(401).json({ message: "Token tidak ditemukan" });
    return false;
  }
  if (access.role === "admin") return true;
  if (!access.divisiId) {
    res.status(403).json({ message: "Akun belum terhubung ke divisi" });
    return false;
  }
  if (divisiId !== access.divisiId) {
    res.status(403).json({ message: "Anda hanya dapat mengakses produksi divisi sendiri" });
    return false;
  }
  return true;
}

export async function getOptionsHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(serialize(await getProduksiOptions()));
  } catch (error) {
    respondError(res, error);
  }
}

export async function listLokasiHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(serialize(await listLokasi()));
  } catch (error) {
    respondError(res, error);
  }
}

export async function listStokGudangHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(serialize(await listStokGudang()));
  } catch (error) {
    respondError(res, error);
  }
}

export async function bomPreviewHandler(req: Request, res: Response) {
  try {
    const outputItemId = parseId(req.query.outputItemId);
    const jumlah = parseQuantity(req.query.jumlah);
    const divisiId = req.query.divisiId === undefined || req.query.divisiId === ""
      ? null
      : parseId(req.query.divisiId);
    if (!outputItemId || !jumlah) {
      return res.status(400).json({ message: "Query outputItemId dan jumlah wajib valid" });
    }
    if (req.query.divisiId !== undefined && req.query.divisiId !== "" && !divisiId) {
      return res.status(400).json({ message: "Query divisiId harus angka bulat positif" });
    }
    if (divisiId && !scopeDivision(req, res, divisiId)) return;
    res.status(200).json(serialize(await getBomPreview(outputItemId, jumlah, divisiId)));
  } catch (error) {
    respondError(res, error);
  }
}

export async function listProduksiHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const divisiId = req.query.divisiId === undefined || req.query.divisiId === ""
      ? null
      : parseId(req.query.divisiId);
    if (req.query.divisiId !== undefined && req.query.divisiId !== "" && !divisiId) {
      return res.status(400).json({ message: "Query divisiId harus angka bulat positif" });
    }
    if (divisiId && !scopeDivision(req, res, divisiId)) return;
    const access = req.access;
    const scopedDivisiId =
      access?.role === "admin" ? divisiId ?? undefined : (access?.divisiId ?? undefined);
    if (!access?.role || (access.role !== "admin" && !scopedDivisiId)) {
      return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
    }
    const dari = req.query.dari ? parseDate(req.query.dari) : null;
    const sampai = req.query.sampai ? parseDate(req.query.sampai) : null;
    if (req.query.dari && !dari) return res.status(400).json({ message: "Query dari tidak valid" });
    if (req.query.sampai && !sampai) return res.status(400).json({ message: "Query sampai tidak valid" });
    res.status(200).json(
      serialize(
        await listProduksi({
          page,
          limit,
          divisiId: scopedDivisiId,
          dari: dari ?? undefined,
          sampai: sampai ?? undefined,
        }),
      ),
    );
  } catch (error) {
    respondError(res, error);
  }
}

export async function getProduksiHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getProduksiById(id);
    if (!row) return res.status(404).json({ message: "Produksi tidak ditemukan" });
    if (!scopeDivision(req, res, row.divisiId)) return;
    res.status(200).json(serialize(row));
  } catch (error) {
    respondError(res, error);
  }
}

export async function createProduksiHandler(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const divisiId = parseId(body.divisiId);
    const outputItemId = parseId(body.outputItemId);
    const tujuanLocationId = parseId(body.tujuanLocationId);
    const jumlah = parseQuantity(body.jumlah);
    const tanggalProduksi = parseDate(body.tanggalProduksi);
    if (!divisiId || !outputItemId || !tujuanLocationId || !jumlah) {
      return res.status(400).json({
        message: "divisiId, outputItemId, tujuanLocationId, dan jumlah wajib valid",
      });
    }
    if (body.tanggalProduksi && !tanggalProduksi) {
      return res.status(400).json({ message: "tanggalProduksi tidak valid" });
    }
    if (!scopeDivision(req, res, divisiId)) return;

    const bahanRaw = body.bahan;
    if (!Array.isArray(bahanRaw) || bahanRaw.length === 0) {
      return res.status(400).json({ message: "Field bahan wajib diisi minimal 1 bahan" });
    }
    const bahan = bahanRaw.map((raw, index) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      const itemId = parseId(row.itemId);
      const sumberLocationId = parseId(row.sumberLocationId);
      if (!itemId || !sumberLocationId) {
        throw new ProduksiHarianError(
          "INPUT_TIDAK_VALID",
          `bahan[${index}] harus punya itemId dan sumberLocationId valid`,
        );
      }
      return { itemId, sumberLocationId };
    });

    const row = await createProduksi(
      {
        divisiId,
        outputItemId,
        jumlah,
        tujuanLocationId,
        tanggalProduksi,
        keterangan: typeof body.keterangan === "string" ? body.keterangan : null,
        bahan,
      },
      req.user?.id ?? null,
    );
    res.status(201).json(serialize(row));
  } catch (error) {
    respondError(res, error);
  }
}

export async function createPenerimaanHandler(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const itemId = parseId(body.itemId);
    const locationId = parseId(body.locationId);
    const jumlah = parseQuantity(body.jumlah);
    const tanggal = parseDate(body.tanggal);
    if (!itemId || !locationId || !jumlah) {
      return res.status(400).json({ message: "itemId, locationId, dan jumlah wajib valid" });
    }
    if (body.tanggal && !tanggal) {
      return res.status(400).json({ message: "tanggal tidak valid" });
    }
    const row = await createPenerimaan(
      {
        itemId,
        locationId,
        jumlah,
        tanggal,
        keterangan: typeof body.keterangan === "string" ? body.keterangan : null,
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
      },
      req.user?.id ?? null,
    );
    res.status(201).json(serialize(row));
  } catch (error) {
    respondError(res, error);
  }
}
