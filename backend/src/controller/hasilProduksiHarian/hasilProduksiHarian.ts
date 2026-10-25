import type { Request, Response } from "express";

import {
  createHasilProduksi,
  getHasilProduksiById,
  getRekapHasilProduksi,
  getWipPerItem,
  listHasilProduksi,
  DIVISI_TIDAK_DITEMUKAN,
  HasilProduksiError,
  ITEM_TIDAK_DITEMUKAN,
  WipKurangError,
  type HasilProduksiInput,
  type HasilProduksiItemInput,
  type HasilProduksiListParams,
  type HasilProduksiRekapParams,
} from "../../model/hasilProduksiHarian/hasilProduksiHarian.js";
import { StokKurangError } from "../../model/stokItem/stokItem.js";
import { getWipLedgerHarian } from "../../model/wip/wip.js";
import { parseTanggalBisnis, awalHariBisnis, tanggalBisnis } from "../../lib/tanggalBisnis.js";
import { getBatasDivisi } from "../../lib/divisiScope.js";
import { TipeHasilProduksiItem } from "../../../generated/prisma/enums.js";

const errCode = (error: unknown): string | undefined => {
  return (error as { code?: string } | null)?.code;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const parseTanggal = (value: unknown): Date | null => parseTanggalBisnis(value);

const parseOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const parseTipe = (value: unknown): TipeHasilProduksiItem | null => {
  if (typeof value !== "string") return null;
  const tipe = value.trim().toUpperCase();
  return tipe === TipeHasilProduksiItem.MASUK ||
    tipe === TipeHasilProduksiItem.KELUAR ||
    tipe === TipeHasilProduksiItem.HASIL
    ? (tipe as TipeHasilProduksiItem)
    : null;
};

const parseJumlah = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const jumlah = Number(value);
  if (!Number.isInteger(jumlah) || jumlah <= 0 || jumlah > 2147483647) return null;
  return jumlah;
};

const parseRentangTanggal = (
  query: Record<string, unknown>,
): { dari?: Date; sampai?: Date } | { error: string } => {
  const rentang: { dari?: Date; sampai?: Date } = {};
  if (query.dari !== undefined && query.dari !== "") {
    const dari = parseTanggal(query.dari);
    if (!dari) return { error: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" };
    rentang.dari = dari;
  }
  if (query.sampai !== undefined && query.sampai !== "") {
    const sampai = parseTanggal(query.sampai);
    if (!sampai) return { error: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" };
    rentang.sampai = sampai;
  }
  if (rentang.dari && rentang.sampai && rentang.dari.getTime() > rentang.sampai.getTime()) {
    return { error: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai" };
  }
  return rentang;
};

const parseFilters = (
  query: Record<string, unknown>,
): HasilProduksiRekapParams | { error: string } => {
  const params: HasilProduksiRekapParams = {};
  if (query.divisiId !== undefined && query.divisiId !== "") {
    const divisiId = parsePositiveInt(query.divisiId);
    if (!divisiId) return { error: "Query 'divisiId' harus angka bulat positif" };
    params.divisiId = divisiId;
  }
  if (query.itemId !== undefined && query.itemId !== "") {
    const itemId = parsePositiveInt(query.itemId);
    if (!itemId) return { error: "Query 'itemId' harus angka bulat positif" };
    params.itemId = itemId;
  }
  const rentang = parseRentangTanggal(query);
  if ("error" in rentang) return rentang;
  if (rentang.dari) params.dari = rentang.dari;
  if (rentang.sampai) params.sampai = rentang.sampai;
  return params;
};

const parseBody = (body: unknown): HasilProduksiInput | { error: string } => {
  const input = (body ?? {}) as Record<string, unknown>;
  const divisiId = parsePositiveInt(input.divisiId);
  if (!divisiId) return { error: "Field 'divisiId' wajib angka bulat positif" };

  let nomor: string | null = null;
  if (input.nomor !== undefined && input.nomor !== null && input.nomor !== "") {
    if (typeof input.nomor !== "string") return { error: "Field 'nomor' harus string" };
    nomor = input.nomor.trim() || null;
    if (nomor && nomor.length > 191) return { error: "Field 'nomor' maksimal 191 karakter" };
  }

  let tanggalProduksi: Date | undefined;
  if (input.tanggalProduksi !== undefined && input.tanggalProduksi !== null && input.tanggalProduksi !== "") {
    const tanggal = parseTanggal(input.tanggalProduksi);
    if (!tanggal) return { error: "Field 'tanggalProduksi' harus tanggal valid" };
    tanggalProduksi = tanggal;
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: "Field 'items' wajib diisi minimal 1 item" };
  }

  const items: HasilProduksiItemInput[] = [];
  for (let index = 0; index < input.items.length; index++) {
    const raw = (input.items[index] ?? {}) as Record<string, unknown>;
    const itemId = parsePositiveInt(raw.itemId);
    if (!itemId) return { error: `items[${index}].itemId wajib angka bulat positif` };
    const tipe = parseTipe(raw.tipe);
    if (!tipe) return { error: `items[${index}].tipe harus MASUK, KELUAR, atau HASIL` };
    const jumlah = parseJumlah(raw.jumlah);
    if (!jumlah) return { error: `items[${index}].jumlah harus bilangan bulat lebih dari 0` };
    items.push({
      itemId,
      tipe,
      jumlah,
      keterangan: parseOptionalString(raw.keterangan),
    });
  }

  return {
    divisiId,
    nomor,
    ...(tanggalProduksi ? { tanggalProduksi } : {}),
    keterangan: parseOptionalString(input.keterangan),
    items,
  };
};

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof StokKurangError || errCode(error) === "STOK_KURANG") {
    return res.status(409).json({ message: error instanceof Error ? error.message : "Stok tidak cukup" });
  }
  if (error instanceof WipKurangError) {
    const permintaan = error.permintaanBarang;
    return res.status(409).json({
      message: error.permintaanError
        ? `${error.message} Permintaan barang otomatis gagal dibuat: ${error.permintaanError}`
        : error.message,
      kode: error.code,
      dataKekurangan: error.dataKekurangan,
      saranTransfer: error.saranTransfer,
      permintaanBarang: permintaan
        ? {
            id: permintaan.id,
            nomor: permintaan.noPermintaan,
            status: permintaan.approval,
            items: permintaan.items.map((item) => ({
              id: item.id,
              itemId: item.itemId,
              nama: item.nama,
              jumlah: item.jumlah,
              satuan: item.satuan,
            })),
          }
        : null,
      ...(error.permintaanError ? { errorPermintaan: error.permintaanError } : {}),
    });
  }
  if (error instanceof HasilProduksiError) {
    if (error.code === DIVISI_TIDAK_DITEMUKAN || error.code === ITEM_TIDAK_DITEMUKAN) {
      return res.status(404).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message });
  }
  if (errCode(error) === "P2002") {
    return res.status(409).json({ message: "Nomor hasil produksi sudah dipakai" });
  }
  if (errCode(error) === "P2025") {
    return res.status(404).json({ message: "Data hasil produksi tidak ditemukan" });
  }
  if (errCode(error) === "P2003") {
    return res.status(404).json({ message: "Divisi atau item tidak ditemukan" });
  }
  return res.status(500).json({ message: fallback, error });
};

// POST /api/hasil-produksi-harian
export async function createHasilProduksiHandler(req: Request, res: Response) {
  try {
    const batas = getBatasDivisi(req.access);
    if (!batas.admin && !batas.divisiId) {
      return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
    }
    const parsed = parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    if (!batas.admin && parsed.divisiId !== batas.divisiId) {
      return res.status(403).json({ message: "Anda hanya dapat mencatat produksi untuk divisi sendiri" });
    }
    const row = await createHasilProduksi(parsed, req.user?.id ?? null);
    return res.status(201).json(row);
  } catch (error) {
    return handleError(res, error, "Gagal menyimpan hasil produksi harian");
  }
}

// GET /api/hasil-produksi-harian
export async function listHasilProduksiHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
    const params: HasilProduksiListParams = { page, limit };

    if (req.query.divisiId !== undefined && req.query.divisiId !== "") {
      const divisiId = parsePositiveInt(req.query.divisiId);
      if (!divisiId) return res.status(400).json({ message: "Query 'divisiId' harus angka bulat positif" });
      params.divisiId = divisiId;
    }
    const rentang = parseRentangTanggal(req.query as Record<string, unknown>);
    if ("error" in rentang) return res.status(400).json({ message: rentang.error });
    if (rentang.dari) params.dari = rentang.dari;
    if (rentang.sampai) params.sampai = rentang.sampai;
    if (typeof req.query.q === "string" && req.query.q.trim()) params.q = req.query.q.trim();

    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (params.divisiId !== undefined && params.divisiId !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat produksi divisi sendiri" });
      }
      params.divisiId = batas.divisiId;
    }

    const result = await listHasilProduksi(params);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil hasil produksi harian", error });
  }
}

// GET /api/hasil-produksi-harian/rekap
export async function getRekapHasilProduksiHandler(req: Request, res: Response) {
  try {
    const params = parseFilters(req.query as Record<string, unknown>);
    if ("error" in params) return res.status(400).json({ message: params.error });
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (params.divisiId !== undefined && params.divisiId !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat rekap divisi sendiri" });
      }
      params.divisiId = batas.divisiId;
    }
    const result = await getRekapHasilProduksi(params);
    return res.status(200).json({ data: result });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil rekap hasil produksi", error });
  }
}

// GET /api/hasil-produksi-harian/wip
export async function getWipPerItemHandler(req: Request, res: Response) {
  try {
    const params = parseFilters(req.query as Record<string, unknown>);
    if ("error" in params) return res.status(400).json({ message: params.error });
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (params.divisiId !== undefined && params.divisiId !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat WIP divisi sendiri" });
      }
      params.divisiId = batas.divisiId;
    }
    const data = await getWipPerItem(params);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil WIP per item", error });
  }
}

// GET /api/hasil-produksi-harian/wip/harian
export async function getWipLedgerHarianHandler(req: Request, res: Response) {
  try {
    const params = parseFilters(req.query as Record<string, unknown>);
    if ("error" in params) return res.status(400).json({ message: params.error });

    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (params.divisiId !== undefined && params.divisiId !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat WIP divisi sendiri" });
      }
      params.divisiId = batas.divisiId;
    }

    const hariIni = new Date();
    params.dari ??= awalHariBisnis(`${tanggalBisnis(hariIni).slice(0, 7)}-01`);
    params.sampai ??= awalHariBisnis(hariIni);
    const result = await getWipLedgerHarian({
      ...(params.divisiId !== undefined ? { divisiId: params.divisiId } : {}),
      ...(params.itemId !== undefined ? { itemId: params.itemId } : {}),
      dari: params.dari,
      sampai: params.sampai,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil rekap harian WIP", error });
  }
}

// GET /api/hasil-produksi-harian/:id
export async function getHasilProduksiHandler(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getHasilProduksiById(id);
    if (!row) return res.status(404).json({ message: "Hasil produksi harian tidak ditemukan" });
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (row.divisiId !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat produksi divisi sendiri" });
      }
    }
    return res.status(200).json(row);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil detail hasil produksi harian", error });
  }
}
