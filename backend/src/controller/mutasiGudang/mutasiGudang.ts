import type { Request, Response } from "express";
import {
  MutasiError,
  catatMutasi,
  catatMutasiBulk,
  listMutasi,
  getMutasiByBarang,
  getMutasiByGudang,
} from "../../model/mutasiGudang/mutasiGudang.js";
import { findBarangByKodeList } from "../../model/barang/barang.js";

function parseId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseTanggal(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/mutasi-gudang — userId selalu dari token, bukan body
export async function catatMutasiHandler(req: Request, res: Response) {
  try {
    const { barangId, kodeBarang, gudangAsalId, gudangTujuanId, keterangan } =
      (req.body ?? {}) as Record<string, unknown>;

    let bid = parseId(barangId);
    if (bid === null && typeof kodeBarang === "string" && kodeBarang.trim()) {
      const found = await findBarangByKodeList([kodeBarang.trim()]);
      bid = found.length > 0 ? found[0].id : null;
      if (bid === null) return res.status(404).json({ message: "Barang tidak ditemukan" });
    }
    if (bid === null) {
      return res.status(400).json({ message: "Field 'barangId' atau 'kodeBarang' wajib diisi valid" });
    }

    if (gudangAsalId === undefined && gudangTujuanId === undefined) {
      return res.status(400).json({ message: "Minimal satu dari 'gudangAsalId' atau 'gudangTujuanId' wajib diisi" });
    }
    const asal = gudangAsalId === undefined || gudangAsalId === null ? null : parseId(gudangAsalId);
    const tujuan = gudangTujuanId === undefined || gudangTujuanId === null ? null : parseId(gudangTujuanId);
    if ((gudangAsalId !== undefined && gudangAsalId !== null && asal === null) ||
        (gudangTujuanId !== undefined && gudangTujuanId !== null && tujuan === null)) {
      return res.status(400).json({ message: "Field 'gudangAsalId'/'gudangTujuanId' harus angka bulat positif atau null" });
    }

    const row = await catatMutasi({
      barangId: bid,
      gudangAsalId: asal,
      gudangTujuanId: tujuan,
      keterangan: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : undefined,
      userId: req.user?.id ?? null,
    });
    res.status(201).json(row);
  } catch (error) {
    if (error instanceof MutasiError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: "Gagal mencatat mutasi gudang", error });
  }
}

// POST /api/mutasi-gudang/bulk — satu tujuan, all-or-nothing, asal otomatis
export async function catatMutasiBulkHandler(req: Request, res: Response) {
  try {
    const { barangIds, gudangTujuanId, keterangan } = (req.body ?? {}) as Record<string, unknown>;

    if (!Array.isArray(barangIds) || barangIds.length === 0) {
      return res.status(400).json({ message: "Field 'barangIds' wajib diisi dan berupa array minimal 1 item" });
    }
    if (barangIds.length > 500) {
      return res.status(400).json({ message: "Field 'barangIds' maksimal 500 per request" });
    }
    const ids: number[] = [];
    for (const raw of barangIds) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Setiap 'barangIds' harus angka bulat positif" });
      }
      ids.push(id);
    }
    if (gudangTujuanId === undefined) {
      return res.status(400).json({ message: "Field 'gudangTujuanId' wajib diisi (atau null untuk mengeluarkan)" });
    }
    const tujuan = gudangTujuanId === null ? null : parseId(gudangTujuanId);
    if (gudangTujuanId !== null && tujuan === null) {
      return res.status(400).json({ message: "Field 'gudangTujuanId' harus angka bulat positif atau null" });
    }

    const result = await catatMutasiBulk({
      barangIds: ids,
      gudangTujuanId: tujuan,
      keterangan: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : undefined,
      userId: req.user?.id ?? null,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof MutasiError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: "Gagal mencatat mutasi massal", error });
  }
}

// GET /api/mutasi-gudang
export async function listMutasiHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { barangId, kodeBarang, gudangId, dari, sampai } = req.query;

    let bid: number | undefined;
    if (barangId !== undefined && barangId !== "") {
      const parsed = parseId(barangId);
      if (parsed === null) return res.status(400).json({ message: "Query 'barangId' harus angka bulat positif" });
      bid = parsed;
    }
    let gid: number | undefined;
    if (gudangId !== undefined && gudangId !== "") {
      const parsed = parseId(gudangId);
      if (parsed === null) return res.status(400).json({ message: "Query 'gudangId' harus angka bulat positif" });
      gid = parsed;
    }
    let tDari: Date | undefined;
    if (dari !== undefined && dari !== "") {
      const parsed = parseTanggal(dari);
      if (!parsed) return res.status(400).json({ message: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" });
      tDari = parsed;
    }
    let tSampai: Date | undefined;
    if (sampai !== undefined && sampai !== "") {
      const parsed = parseTanggal(sampai);
      if (!parsed) return res.status(400).json({ message: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      tSampai = parsed;
    }

    const result = await listMutasi({
      page,
      limit,
      barangId: bid,
      kodeBarang: typeof kodeBarang === "string" && kodeBarang.trim() ? kodeBarang.trim() : undefined,
      gudangId: gid,
      dari: tDari,
      sampai: tSampai,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat mutasi", error });
  }
}

// GET /api/mutasi-gudang/barang/:barangId
export async function getMutasiBarangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.barangId);
    if (id === null) return res.status(400).json({ message: "ID barang harus angka bulat positif" });
    res.status(200).json(await getMutasiByBarang(id));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat mutasi barang", error });
  }
}

// GET /api/mutasi-gudang/gudang/:gudangId
export async function getMutasiGudangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.gudangId);
    if (id === null) return res.status(400).json({ message: "ID gudang harus angka bulat positif" });
    res.status(200).json(await getMutasiByGudang(id));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat mutasi gudang", error });
  }
}
