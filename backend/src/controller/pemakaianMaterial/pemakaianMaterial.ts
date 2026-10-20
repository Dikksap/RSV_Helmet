import type { Request, Response } from "express";

import {
  createPemakaian,
  deletePemakaian,
  getPemakaianById,
  getStokPerDivisi,
  listPemakaian,
  updatePemakaian,
  type PemakaianInput,
  PemakaianError,
  PERMINTAAN_TIDAK_DITEMUKAN,
  DIVISI_TIDAK_DITEMUKAN,
  ITEM_PERMINTAAN_TIDAK_VALID,
  PEMAKAIAN_DUPLIKAT_ITEM,
  JUMLAH_PEMAKAIAN_INVALID,
} from "../../model/pemakaianMaterial/pemakaianMaterial.js";

const errCode = (error: unknown): string | undefined => {
  return (error as { code?: string } | null)?.code;
};

const parseTanggal = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const parsePositiveInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const parseDecimal = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Query 'dari'/'sampai' (YYYY-MM-DD, inklusif) dipakai list pemakaian dan stok per divisi.
const parseRentangTanggal = (
  query: Record<string, unknown>,
): { dari?: Date; sampai?: Date } | { error: string } => {
  const rentang: { dari?: Date; sampai?: Date } = {};
  if (query.dari !== undefined && query.dari !== "") {
    const d = parseTanggal(query.dari);
    if (!d) return { error: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" };
    rentang.dari = d;
  }
  if (query.sampai !== undefined && query.sampai !== "") {
    const d = parseTanggal(query.sampai);
    if (!d) return { error: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" };
    rentang.sampai = d;
  }
  if (rentang.dari && rentang.sampai && rentang.dari.getTime() > rentang.sampai.getTime()) {
    return { error: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai" };
  }
  return rentang;
};

type ParseResult = PemakaianInput | { error: string };
type ItemParseResult = PemakaianInput["items"][number] | { error: string };

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof PemakaianError) {
    if (error.code === PERMINTAAN_TIDAK_DITEMUKAN || error.code === DIVISI_TIDAK_DITEMUKAN)
      return res.status(404).json({ message: error.message });
    return res.status(400).json({ message: error.message });
  }
  if (errCode(error) === "P2002") {
    return res.status(409).json({ message: "Nomor transaksi pemakaian bentrok, coba ulang" });
  }
  if (errCode(error) === "P2025") {
    return res.status(404).json({ message: "Data tidak ditemukan" });
  }
  return res.status(500).json({ message: fallback, error });
};

const parseBody = async (body: unknown): Promise<ParseResult> => {
  const o = (body ?? {}) as Record<string, unknown>;

  const permintaanId = parsePositiveInt(o.permintaanId);
  if (!permintaanId) return { error: "Field 'permintaanId' wajib angka bulat positif" };
  const divisiId = parsePositiveInt(o.divisiId);
  if (!divisiId) return { error: "Field 'divisiId' wajib angka bulat positif" };

  let tanggal: Date | null = null;
  if (o.tanggal !== undefined && o.tanggal !== null && o.tanggal !== "") {
    const d = parseTanggal(o.tanggal);
    if (!d) return { error: "Field 'tanggal' harus tanggal valid" };
    tanggal = d;
  }

  const keterangan = parseOptionalString(o.keterangan);
  const defaultSisa = parseOptionalString(o.keteranganSisa);

  if (!Array.isArray(o.items) || o.items.length === 0)
    return { error: "Field 'items' wajib diisi minimal 1 item" };

  const items: ItemParseResult[] = [];
  for (let index = 0; index < o.items.length; index++) {
    const raw = (o.items[index] ?? {}) as Record<string, unknown>;
    const permintaanBarangItemId = parsePositiveInt(raw.permintaanBarangItemId);
    if (!permintaanBarangItemId) {
      return { error: `items[${index}].permintaanBarangItemId wajib angka bulat positif` };
    }

    if (raw.jumlahSisa === undefined || raw.jumlahSisa === null || raw.jumlahSisa === "") {
      return { error: `items[${index}].jumlahSisa wajib diisi` };
    }
    const jumlahSisa = parseDecimal(raw.jumlahSisa);
    if (jumlahSisa === null) {
      return { error: `items[${index}] jumlahSisa harus berupa angka valid` };
    }
    if (jumlahSisa < 0) {
      return { error: `items[${index}] jumlahSisa tidak boleh negatif` };
    }

    const satuan = raw.satuan === null ? null : parseOptionalString(raw.satuan);
    items.push({
      permintaanBarangItemId,
      jumlahSisa,
      satuan,
      keteranganSisa:
        raw.keteranganSisa === undefined ? defaultSisa : parseOptionalString(raw.keteranganSisa),
    });
  }

  return {
    permintaanId,
    divisiId,
    tanggal,
    keterangan,
    items: items as PemakaianInput["items"],
  };
};

// GET /api/pemakaian-material
export async function listPemakaianHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const params: Parameters<typeof listPemakaian>[0] = { page, limit };

    if (req.query.permintaanId !== undefined && req.query.permintaanId !== "") {
      const id = parsePositiveInt(req.query.permintaanId);
      if (!id) return res.status(400).json({ message: "Query 'permintaanId' harus angka bulat positif" });
      params.permintaanId = id;
    }
    if (req.query.divisiId !== undefined && req.query.divisiId !== "") {
      const id = parsePositiveInt(req.query.divisiId);
      if (!id) return res.status(400).json({ message: "Query 'divisiId' harus angka bulat positif" });
      params.divisiId = id;
    }
    const rentang = parseRentangTanggal(req.query as Record<string, unknown>);
    if ("error" in rentang) return res.status(400).json({ message: rentang.error });
    if (rentang.dari) params.dari = rentang.dari;
    if (rentang.sampai) params.sampai = rentang.sampai;
    const result = await listPemakaian(params);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data pemakaian material", error });
  }
}

// GET /api/pemakaian-material/stok-divisi
export async function getStokDivisiHandler(req: Request, res: Response) {
  try {
    const rentang = parseRentangTanggal(req.query as Record<string, unknown>);
    if ("error" in rentang) return res.status(400).json({ message: rentang.error });
    const data = await getStokPerDivisi(rentang);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil stok per divisi", error });
  }
}

// GET /api/pemakaian-material/:id
export async function getPemakaianHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id as string);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getPemakaianById(id);
    if (!row) return res.status(404).json({ message: "Pemakaian material tidak ditemukan" });
    return res.status(200).json(row);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data pemakaian material", error });
  }
}

// POST /api/pemakaian-material
export async function createPemakaianHandler(req: Request, res: Response) {
  try {
    const parsed = await parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await createPemakaian(parsed, req.user?.id ?? null);
    return res.status(201).json(row);
  } catch (error) {
    handleError(res, error, "Gagal menyimpan pemakaian material");
  }
}

// PUT /api/pemakaian-material/:id
export async function updatePemakaianHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id as string);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const parsed = await parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await updatePemakaian(id, parsed, req.user?.id ?? null);
    if (!row) return res.status(404).json({ message: "Pemakaian material tidak ditemukan" });
    return res.status(200).json(row);
  } catch (error) {
    handleError(res, error, "Gagal memperbarui pemakaian material");
  }
}

// DELETE /api/pemakaian-material/:id
export async function deletePemakaianHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id as string);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const deleted = await deletePemakaian(id);
    if (!deleted) return res.status(404).json({ message: "Pemakaian material tidak ditemukan" });
    return res.status(200).json({ message: "Pemakaian material berhasil dihapus" });
  } catch (error) {
    handleError(res, error, "Gagal menghapus pemakaian material");
  }
}
