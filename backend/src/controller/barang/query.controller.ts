import { Request, Response } from "express";
import {
  getBarangById,
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  getRiwayatByBarangId,
  getStatusSummary,
  listBarang,
  searchBarangByKode,
} from "../../model/barang/barang.js";
import type { StatusBarang } from "../../model/barang/barang.js";

function toStartOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

function toEndOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(23, 59, 59, 999);
  return c;
}

function parseTanggalAwal(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return toStartOfDay(d);
}

function parseTanggalAkhir(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return toEndOfDay(d);
}

export async function listBarangHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { variantId, batchId, status, tanggalAwal, tanggalAkhir, tanggal } = req.query;

    if (status && !["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"].includes(String(status))) {
      return res.status(400).json({
        message:
          "Parameter 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    let vid: number | undefined;
    if (variantId !== undefined) {
      vid = Number(variantId);
      if (Number.isNaN(vid)) {
        return res.status(400).json({ message: "Parameter 'variantId' harus angka" });
      }
    }

    let bid: number | undefined;
    if (batchId !== undefined) {
      bid = Number(batchId);
      if (Number.isNaN(bid)) {
        return res.status(400).json({ message: "Parameter 'batchId' harus angka" });
      }
    }

    let tAwal: Date | undefined;
    let tAkhir: Date | undefined;

    // Shortcut: ?tanggal=YYYY-MM-DD  -> filter satu hari penuh
    if (tanggal && !tanggalAwal && !tanggalAkhir) {
      const parsed = parseTanggalAwal(tanggal as string);
      if (!parsed) {
        return res.status(400).json({
          message: "Parameter 'tanggal' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      tAwal = toStartOfDay(parsed);
      tAkhir = toEndOfDay(parsed);
    } else {
      if (tanggalAwal) {
        const parsed = parseTanggalAwal(tanggalAwal as string);
        if (!parsed) {
          return res.status(400).json({
            message: "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)",
          });
        }
        tAwal = parsed;
      }

      if (tanggalAkhir) {
        const parsed = parseTanggalAkhir(tanggalAkhir as string);
        if (!parsed) {
          return res.status(400).json({
            message: "Parameter 'tanggalAkhir' harus tanggal valid (YYYY-MM-DD)",
          });
        }
        tAkhir = parsed;
      }
    }

    if (tAwal && tAkhir && tAwal.getTime() > tAkhir.getTime()) {
      return res.status(400).json({
        message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'",
      });
    }

    const result = await listBarang({
      page,
      limit,
      variantId: vid,
      batchId: bid,
      status: status as StatusBarang | undefined,
      tanggalAwal: tAwal,
      tanggalAkhir: tAkhir,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data barang", error });
  }
}

export async function getBarangDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const barang = await getBarangById(id);

    if (!barang) {
      return res.status(404).json({ message: "Barang tidak ditemukan" });
    }

    res.status(200).json(barang);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data barang", error });
  }
}

export async function getRiwayatHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const result = await getRiwayatByBarangId(id);

    if (!result) {
      return res.status(404).json({ message: "Barang tidak ditemukan" });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat barang", error });
  }
}

export async function getStatusSummaryHandler(_req: Request, res: Response) {
  try {
    const result = await getStatusSummary();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil ringkasan status", error });
  }
}

export async function getStatsHandler(req: Request, res: Response) {
  try {
    const { variantId, batchId } = req.query;
    const filter: { variantId?: number; batchId?: number } = {};

    if (variantId !== undefined) {
      const v = Number(variantId);
      if (Number.isNaN(v)) {
        return res.status(400).json({ message: "Parameter 'variantId' harus angka" });
      }
      filter.variantId = v;
    }

    if (batchId !== undefined) {
      const b = Number(batchId);
      if (Number.isNaN(b)) {
        return res.status(400).json({ message: "Parameter 'batchId' harus angka" });
      }
      filter.batchId = b;
    }

    const result = await getBarangStats(filter);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil statistik barang", error });
  }
}

export async function getBatchRentangTanggalHandler(req: Request, res: Response) {
  try {
    const { tanggalAwal, tanggalAkhir } = req.query;
    const filter: { tanggalAwal?: Date; tanggalAkhir?: Date } = {};

    if (tanggalAwal) {
      const t = new Date(tanggalAwal as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAwal = toStartOfDay(t);
    }

    if (tanggalAkhir) {
      const t = new Date(tanggalAkhir as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAkhir' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAkhir = toEndOfDay(t);
    }

    if (filter.tanggalAwal && filter.tanggalAkhir && filter.tanggalAwal.getTime() > filter.tanggalAkhir.getTime()) {
      return res.status(400).json({
        message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'",
      });
    }

    const result = await getBatchRentangTanggal(filter);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil rentang tanggal batch", error });
  }
}

export async function getFinishgoodPerBulanHandler(req: Request, res: Response) {
  try {
    const { variantId, productId, tanggalAwal, tanggalAkhir } = req.query;
    const filter: {
      variantId?: number;
      productId?: number;
      tanggalAwal?: Date;
      tanggalAkhir?: Date;
    } = {};

    if (variantId !== undefined) {
      const v = Number(variantId);
      if (Number.isNaN(v)) {
        return res.status(400).json({ message: "Parameter 'variantId' harus angka" });
      }
      filter.variantId = v;
    }

    if (productId !== undefined) {
      const p = Number(productId);
      if (Number.isNaN(p)) {
        return res.status(400).json({ message: "Parameter 'productId' harus angka" });
      }
      filter.productId = p;
    }

    if (tanggalAwal) {
      const t = new Date(tanggalAwal as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAwal = toStartOfDay(t);
    }

    if (tanggalAkhir) {
      const t = new Date(tanggalAkhir as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAkhir' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAkhir = toEndOfDay(t);
    }

    if (filter.tanggalAwal && filter.tanggalAkhir && filter.tanggalAwal.getTime() > filter.tanggalAkhir.getTime()) {
      return res.status(400).json({
        message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'",
      });
    }

    const result = await getFinishgoodPerBulan(filter);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil jumlah finish good per bulan", error });
  }
}

export async function searchBarangHandler(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length === 0) {
      return res.status(400).json({ message: "Query parameter 'q' wajib diisi" });
    }
    if (q.length > 100) {
      return res.status(400).json({ message: "Query parameter 'q' maksimal 100 karakter" });
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await searchBarangByKode({ q, limit });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mencari barang", error });
  }
}
