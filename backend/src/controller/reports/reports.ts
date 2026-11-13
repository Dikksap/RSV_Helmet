import type { Request, Response } from "express";
import { parseTanggalBisnis } from "../../lib/tanggalBisnis.js";
import {
  buildPeriod,
  getFinishedGoodsSummary,
  getMaterialConsumption,
  getReconciliation,
  getTraceability,
  type ReportFilter,
} from "../../model/reports/reports.js";

function positiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

type Parsed =
  | { ok: true; filter: ReportFilter; basis?: "FINISHGOOD" | "PRODUKSI"; kodeBarang?: string; barangId?: number }
  | { ok: false; status: number; message: string };

function parseQuery(req: Request, options: { requirePeriod?: boolean; allowBasis?: boolean } = {}): Parsed {
  const fromRaw = req.query.from;
  const toRaw = req.query.to;
  const requirePeriod = options.requirePeriod !== false;
  let from: Date | null = null;
  let to: Date | null = null;
  if (fromRaw !== undefined && fromRaw !== "") {
    from = parseTanggalBisnis(fromRaw);
    if (!from) return { ok: false, status: 400, message: "Query 'from' harus tanggal valid (YYYY-MM-DD)" };
  }
  if (toRaw !== undefined && toRaw !== "") {
    to = parseTanggalBisnis(toRaw);
    if (!to) return { ok: false, status: 400, message: "Query 'to' harus tanggal valid (YYYY-MM-DD)" };
  }
  if (requirePeriod && (!from || !to)) {
    return { ok: false, status: 400, message: "Query 'from' dan 'to' wajib diisi" };
  }
  if (from && to && from > to) {
    return { ok: false, status: 400, message: "Query 'from' tidak boleh melebihi 'to'" };
  }
  const nowadays = new Date();
  const period = buildPeriod(from ?? nowadays, to ?? nowadays);
  const filter: ReportFilter = { ...period };

  const productId = positiveInt(req.query.productId);
  const variantId = positiveInt(req.query.variantId);
  const orderId = positiveInt(req.query.orderId);
  const divisiId = positiveInt(req.query.divisiId);
  const itemId = positiveInt(req.query.itemId);
  const limit = positiveInt(req.query.limit);
  if (productId !== undefined) filter.productId = productId;
  if (variantId !== undefined) filter.variantId = variantId;
  if (orderId !== undefined) filter.orderId = orderId;
  if (itemId !== undefined) filter.itemId = itemId;
  if (limit !== undefined) filter.limit = limit;

  const scopeDivisi = req.access?.role === "admin" ? null : req.access?.divisiId ?? null;
  if (scopeDivisi !== null) {
    filter.divisiId = scopeDivisi;
  } else if (divisiId !== undefined) {
    filter.divisiId = divisiId;
  }

  const status = req.query.status;
  if (typeof status === "string" && status.trim()) filter.status = status.trim().toUpperCase();

  let basis: "FINISHGOOD" | "PRODUKSI" | undefined;
  if (options.allowBasis && req.query.basis !== undefined) {
    const raw = String(req.query.basis).trim().toUpperCase();
    if (raw !== "FINISHGOOD" && raw !== "PRODUKSI") {
      return { ok: false, status: 400, message: "Query 'basis' harus FINISHGOOD atau PRODUKSI" };
    }
    basis = raw;
  }

  const kodeBarang = typeof req.query.kodeBarang === "string" ? req.query.kodeBarang.trim() : undefined;
  const barangId = positiveInt(req.query.barangId);
  return { ok: true, filter, ...(basis ? { basis } : {}), ...(kodeBarang ? { kodeBarang } : {}), ...(barangId ? { barangId } : {}) };
}

function fail(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Gagal membangun laporan";
  return res.status(500).json({ message });
}

export async function getFinishedGoodsSummaryHandler(req: Request, res: Response) {
  const parsed = parseQuery(req);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });
  try {
    return res.json(await getFinishedGoodsSummary(parsed.filter));
  } catch (error) {
    return fail(res, error);
  }
}

export async function getMaterialConsumptionHandler(req: Request, res: Response) {
  const parsed = parseQuery(req, { allowBasis: true });
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });
  try {
    return res.json(await getMaterialConsumption({ ...parsed.filter, ...(parsed.basis ? { basis: parsed.basis } : {}) }));
  } catch (error) {
    return fail(res, error);
  }
}

export async function getTraceabilityHandler(req: Request, res: Response) {
  const parsed = parseQuery(req, { requirePeriod: false });
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });
  if (!parsed.kodeBarang && parsed.barangId === undefined) {
    const hasPeriod = req.query.from !== undefined && req.query.to !== undefined;
    if (!hasPeriod) {
      return res.status(400).json({
        message: "Sertakan 'kodeBarang'/'barangId', atau 'from' dan 'to' untuk daftar unit FINISHGOOD",
      });
    }
  }
  try {
    return res.json(
      await getTraceability({
        ...parsed.filter,
        ...(parsed.kodeBarang ? { kodeBarang: parsed.kodeBarang } : {}),
        ...(parsed.barangId !== undefined ? { barangId: parsed.barangId } : {}),
      }),
    );
  } catch (error) {
    return fail(res, error);
  }
}

export async function getReconciliationHandler(req: Request, res: Response) {
  const parsed = parseQuery(req);
  if (!parsed.ok) return res.status(parsed.status).json({ message: parsed.message });
  try {
    return res.json(await getReconciliation(parsed.filter));
  } catch (error) {
    return fail(res, error);
  }
}
