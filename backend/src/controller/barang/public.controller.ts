import type { Request, Response } from "express";
import {
  getBarangByKode,
  getBarangRekapVariantPublic,
  listBarang,
} from "../../model/barang/barang.js";
import type { StatusBarang } from "../../model/barang/barang.js";
import { getValidStatusList, isValidStatus } from "./helpers.js";
import { parseTanggalAkhir, parseTanggalAwal } from "./query.controller.js";

// Endpoint publik read-only: tanpa login, semua status terlihat.
// Dipakai untuk cek unit barang berdasarkan kode dari luar aplikasi.

// GET /api/public/barang?page=&limit=&variantId=&status=
export async function listPublicBarangHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    let variantId: number | undefined;
    if (req.query.variantId !== undefined && req.query.variantId !== "") {
      variantId = Number(req.query.variantId);
      if (!Number.isInteger(variantId) || variantId <= 0) {
        return res.status(400).json({ message: "Query 'variantId' harus angka bulat positif" });
      }
    }

    const status = typeof req.query.status === "string" && req.query.status.trim()
      ? (req.query.status.trim().toUpperCase() as StatusBarang)
      : undefined;
    if (status && !(await isValidStatus(status))) {
      return res.status(400).json({
        message: `Query 'status' tidak valid. Status aktif: ${await getValidStatusList()}`,
      });
    }

    const result = await listBarang({ page, limit, variantId, status });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data barang", error });
  }
}

// GET /api/public/barang/rekap-variant?tanggalAwal=&tanggalAkhir=
export async function getPublicRekapVariantHandler(req: Request, res: Response) {
  try {
    const { tanggalAwal, tanggalAkhir } = req.query;
    const filter: { tanggalAwal?: Date; tanggalAkhir?: Date } = {};

    if (tanggalAwal) {
      const parsed = parseTanggalAwal(tanggalAwal as string);
      if (!parsed) {
        return res.status(400).json({
          message: "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAwal = parsed;
    }

    if (tanggalAkhir) {
      const parsed = parseTanggalAkhir(tanggalAkhir as string);
      if (!parsed) {
        return res.status(400).json({
          message: "Parameter 'tanggalAkhir' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAkhir = parsed;
    }

    if (
      filter.tanggalAwal &&
      filter.tanggalAkhir &&
      filter.tanggalAwal.getTime() > filter.tanggalAkhir.getTime()
    ) {
      return res.status(400).json({
        message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'",
      });
    }

    const result = await getBarangRekapVariantPublic(filter);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil rekap barang per varian",
      error,
    });
  }
}

// GET /api/public/barang/:kodeBarang
export async function getPublicBarangHandler(req: Request, res: Response) {
  try {
    const kodeBarang = String(req.params.kodeBarang ?? "").trim();
    if (!kodeBarang) {
      return res.status(400).json({ message: "Kode barang wajib diisi" });
    }

    const barang = await getBarangByKode(kodeBarang);
    if (!barang) {
      return res.status(404).json({ message: "Barang tidak ditemukan" });
    }

    res.status(200).json(barang);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data barang", error });
  }
}
