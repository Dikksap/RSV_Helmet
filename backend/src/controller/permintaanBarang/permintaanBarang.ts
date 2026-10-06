import type { Request, Response } from "express";
import {
  PermintaanTerkunciError,
  createPermintaan,
  deletePermintaan,
  getPermintaanById,
  listPermintaan,
  setApproval,
  updatePermintaan,
  type ApprovalPermintaan,
  type PermintaanInput,
} from "../../model/permintaanBarang/permintaanBarang.js";

const KEBUTUHAN_UNTUK = ["Produksi", "Maintenance", "Proyek"] as const;
const PRIORITAS = ["Normal", "Urgent"] as const;
const APPROVAL = ["BELUM_DISETUJUI", "DISETUJUI"] as const;

type ParseResult = PermintaanInput | { error: string };
type ItemParseResult = PermintaanInput["items"][number] | { error: string };
type EnumParse<T extends string> = { ok: T } | { error: string };

function errCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

function parseTanggal(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): EnumParse<T> {
  if (value === undefined || value === null || value === "") {
    if (fallback === null) {
      return { error: `Nilai wajib diisi, harus salah satu dari: ${allowed.join(", ")}` };
    }
    return { ok: fallback };
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { error: `Nilai '${String(value)}' tidak valid, harus salah satu dari: ${allowed.join(", ")}` };
  }
  return { ok: value as T };
}

function parseBody(body: unknown): ParseResult {
  const { tanggal, departemen, namaPeminta, kebutuhanUntuk, prioritas, tanggalDibutuhkan, alasan, items } =
    (body ?? {}) as Record<string, unknown>;

  const tanggalDate = parseTanggal(tanggal);
  if (!tanggalDate) return { error: "Field 'tanggal' wajib diisi dan harus tanggal valid" };

  if (typeof departemen !== "string" || !departemen.trim()) {
    return { error: "Field 'departemen' wajib diisi" };
  }
  if (typeof namaPeminta !== "string" || !namaPeminta.trim()) {
    return { error: "Field 'namaPeminta' wajib diisi" };
  }
  if (typeof alasan !== "string" || !alasan.trim()) {
    return { error: "Field 'alasan' wajib diisi" };
  }

  const kebutuhan = parseEnum(kebutuhanUntuk, KEBUTUHAN_UNTUK, "Produksi");
  if ("error" in kebutuhan) return kebutuhan;
  const prio = parseEnum(prioritas, PRIORITAS, "Normal");
  if ("error" in prio) return prio;

  if (tanggalDibutuhkan !== undefined && tanggalDibutuhkan !== null && tanggalDibutuhkan !== "") {
    if (!parseTanggal(tanggalDibutuhkan)) return { error: "Field 'tanggalDibutuhkan' harus tanggal valid" };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Field 'items' wajib diisi minimal 1 barang" };
  }

  const parsedItems: ItemParseResult[] = items.map((raw, index): ItemParseResult => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const nama = typeof item.nama === "string" ? item.nama.trim() : "";
    if (!nama) return { error: `items[${index}].nama wajib diisi` };
    const jumlah = Number(item.jumlah);
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      return { error: `items[${index}].jumlah harus angka bulat lebih dari 0` };
    }
    return {
      nama,
      spesifikasi: parseOptionalString(item.spesifikasi),
      jumlah,
      satuan: parseOptionalString(item.satuan),
    };
  });
  for (const parsed of parsedItems) {
    if ("error" in parsed) return parsed;
  }

  return {
    tanggal: tanggalDate,
    departemen: departemen.trim(),
    namaPeminta: namaPeminta.trim(),
    kebutuhanUntuk: kebutuhan.ok,
    prioritas: prio.ok,
    tanggalDibutuhkan: tanggalDibutuhkan ? parseTanggal(tanggalDibutuhkan) : null,
    alasan: alasan.trim(),
    items: parsedItems as PermintaanInput["items"],
  };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/permintaan-barang
export async function listPermintaanHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    let approval: ApprovalPermintaan | undefined;
    if (req.query.approval !== undefined && req.query.approval !== "") {
      const parsed = parseEnum(req.query.approval, APPROVAL, null);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      approval = parsed.ok;
    }
    const result = await listPermintaan({ page, limit, approval });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data permintaan barang", error });
  }
}

// GET /api/permintaan-barang/:id
export async function getPermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getPermintaanById(id);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data permintaan barang", error });
  }
}

// POST /api/permintaan-barang
export async function createPermintaanHandler(req: Request, res: Response) {
  try {
    const parsed = parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await createPermintaan(parsed);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan permintaan barang", error });
  }
}

// PUT /api/permintaan-barang/:id
export async function updatePermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const parsed = parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await updatePermintaan(id, parsed);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    if (error instanceof PermintaanTerkunciError) {
      return res.status(409).json({ message: error.message });
    }
    if (errCode(error) === "P2025") {
      return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal memperbarui permintaan barang", error });
  }
}

// PATCH /api/permintaan-barang/:id/approval
export async function setApprovalHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { approval } = (req.body ?? {}) as { approval?: unknown };
    const parsed = parseEnum(approval, APPROVAL, null);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await setApproval(id, parsed.ok);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui status approval", error });
  }
}

// DELETE /api/permintaan-barang/:id
export async function deletePermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const deleted = await deletePermintaan(id);
    if (!deleted) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json({ message: "Permintaan berhasil dihapus" });
  } catch (error) {
    if (error instanceof PermintaanTerkunciError) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Gagal menghapus permintaan barang", error });
  }
}
