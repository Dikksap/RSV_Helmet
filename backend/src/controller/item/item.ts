import type { Request, Response } from "express";
import {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  bulkUpdateItems,
  DivisiTidakDikenalError,
} from "../../model/item/item.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseDivisiId(value: unknown): { divisiId?: number | null } | { error: string } {
  if (value === undefined || value === "") return {};
  if (value === null) return { divisiId: null };
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return { error: "Field 'divisiId' harus angka bulat positif" };
  return { divisiId: id };
}

function parseJenis(value: unknown): { jenis?: string | null } | { error: string } {
  if (value === undefined || value === "") return {};
  if (value === null) return { jenis: null };
  if (typeof value !== "string" || !value.trim()) return { error: "Field 'jenis' tidak boleh kosong" };
  if (value.trim().length > 50) return { error: "Field 'jenis' maksimal 50 karakter" };
  return { jenis: value.trim() };
}

function parseBody(body: unknown):
  | { kode: string; nama: string; divisiId?: number | null; unit?: string; jenis?: string | null; isActive?: boolean }
  | { error: string } {
  const { kode, nama, divisiId, unit, jenis, isActive } = (body ?? {}) as Record<string, unknown>;
  if (!kode || typeof kode !== "string" || !kode.trim()) return { error: "Field 'kode' wajib diisi" };
  if (kode.trim().length > 30) return { error: "Field 'kode' maksimal 30 karakter" };
  if (!nama || typeof nama !== "string" || !nama.trim()) return { error: "Field 'nama' wajib diisi" };
  const parsedDivisi = parseDivisiId(divisiId);
  if ("error" in parsedDivisi) return parsedDivisi;
  if (unit !== undefined && (typeof unit !== "string" || !unit.trim())) {
    return { error: "Field 'unit' tidak boleh kosong" };
  }
  const parsedJenis = parseJenis(jenis);
  if ("error" in parsedJenis) return parsedJenis;
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return { error: "Field 'isActive' harus boolean" };
  }
  return {
    kode: kode.trim().toUpperCase(),
    nama: nama.trim(),
    ...parsedDivisi,
    ...(unit !== undefined ? { unit: unit.trim() } : {}),
    ...parsedJenis,
    ...(isActive !== undefined ? { isActive } : {}),
  };
}

// GET /api/items (publik: dipakai dropdown form permintaan tanpa login)
export async function listItemsHandler(req: Request, res: Response) {
  try {
    const { q, divisiId, aktif, jenis } = req.query;
    let did: number | undefined;
    if (divisiId !== undefined && divisiId !== "") {
      did = Number(divisiId);
      if (!Number.isInteger(did) || did <= 0) {
        return res.status(400).json({ message: "Query 'divisiId' harus angka bulat positif" });
      }
    }
    let aktifFilter: boolean | undefined;
    if (aktif !== undefined && aktif !== "") {
      if (aktif === "true" || aktif === "1") aktifFilter = true;
      else if (aktif === "false" || aktif === "0") aktifFilter = false;
      else return res.status(400).json({ message: "Query 'aktif' harus 'true' atau 'false'" });
    }
    const rows = await listItems({
      q: typeof q === "string" && q.trim() ? q.trim() : undefined,
      divisiId: did,
      aktif: aktifFilter,
      jenis: typeof jenis === "string" && jenis.trim() ? jenis.trim() : undefined,
    });
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data item", error });
  }
}

// GET /api/items/:id (publik)
export async function getItemDetail(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getItemById(id);
    if (!row) return res.status(404).json({ message: "Item tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data item", error });
  }
}

// POST /api/items
export async function createItemHandler(req: Request, res: Response) {
  try {
    const parsed = parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await createItem(parsed);
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode item sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Divisi tidak ditemukan" });
    res.status(500).json({ message: "Gagal membuat item", error });
  }
}

// PUT /api/items/:id
export async function updateItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { kode, nama, divisiId, unit, jenis, isActive } = (req.body ?? {}) as Record<string, unknown>;
    if (kode === undefined && nama === undefined && divisiId === undefined && unit === undefined && jenis === undefined && isActive === undefined) {
      return res.status(400).json({ message: "Minimal satu field: kode, nama, divisiId, unit, jenis, isActive" });
    }
    const data: { kode?: string; nama?: string; divisiId?: number | null; unit?: string; jenis?: string | null; isActive?: boolean } = {};
    if (kode !== undefined) {
      if (typeof kode !== "string" || !kode.trim()) return res.status(400).json({ message: "Field 'kode' tidak boleh kosong" });
      if (kode.trim().length > 30) return res.status(400).json({ message: "Field 'kode' maksimal 30 karakter" });
      data.kode = kode.trim().toUpperCase();
    }
    if (nama !== undefined) {
      if (typeof nama !== "string" || !nama.trim()) return res.status(400).json({ message: "Field 'nama' tidak boleh kosong" });
      data.nama = nama.trim();
    }
    if (divisiId !== undefined) {
      const parsedDivisi = parseDivisiId(divisiId);
      if ("error" in parsedDivisi) return res.status(400).json({ message: parsedDivisi.error });
      Object.assign(data, parsedDivisi);
    }
    if (unit !== undefined) {
      if (typeof unit !== "string" || !unit.trim()) return res.status(400).json({ message: "Field 'unit' tidak boleh kosong" });
      data.unit = unit.trim();
    }
    if (jenis !== undefined) {
      const parsedJenis = parseJenis(jenis);
      if ("error" in parsedJenis) return res.status(400).json({ message: parsedJenis.error });
      Object.assign(data, parsedJenis);
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "Field 'isActive' harus boolean" });
      data.isActive = isActive;
    }
    const row = await updateItem(id, data);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Item tidak ditemukan" });
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode item sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Divisi tidak ditemukan" });
    res.status(500).json({ message: "Gagal mengupdate item", error });
  }
}

// DELETE /api/items/:id — rincian permintaan lama ikut SetNull, snapshot tetap
export async function deleteItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteItem(id);
    res.status(200).json({ message: "Item berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Item tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus item", error });
  }
}

const BULK_MAKS = 500;

// PUT /api/items/bulk — edit massal kolom bebas (jenis, divisiId), satu query atomik.
// Field `undefined` = tak diubah; `null` = kosongkan. ID tak dikenal diabaikan (lihat `updated`).
export async function bulkUpdateItemsHandler(req: Request, res: Response) {
  try {
    const { ids, jenis, divisiId } = (req.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Field 'ids' wajib array ID non-kosong" });
    }
    if (ids.length > BULK_MAKS) {
      return res.status(400).json({ message: `Maksimal ${BULK_MAKS} item per sekali edit massal` });
    }
    const parsed = ids.map(Number);
    if (parsed.some((n) => !Number.isInteger(n) || n <= 0)) {
      return res.status(400).json({ message: "Field 'ids' harus berisi angka bulat positif" });
    }
    const data: { jenis?: string | null; divisiId?: number | null } = {};
    if (jenis !== undefined) {
      if (jenis === null) data.jenis = null;
      else {
        const parsedJenis = parseJenis(jenis);
        if ("error" in parsedJenis) return res.status(400).json({ message: parsedJenis.error });
        if (!("jenis" in parsedJenis)) return res.status(400).json({ message: "Field 'jenis' wajib string atau null" });
        data.jenis = parsedJenis.jenis ?? null;
      }
    }
    if (divisiId !== undefined) {
      if (divisiId === null || divisiId === "") data.divisiId = null;
      else {
        const parsedDivisi = parseDivisiId(divisiId);
        if ("error" in parsedDivisi) return res.status(400).json({ message: parsedDivisi.error });
        if (!("divisiId" in parsedDivisi)) return res.status(400).json({ message: "Field 'divisiId' wajib angka atau null" });
        data.divisiId = parsedDivisi.divisiId ?? null;
      }
    }
    if (data.jenis === undefined && data.divisiId === undefined) {
      return res.status(400).json({ message: "Minimal satu field: jenis, divisiId" });
    }
    const updated = await bulkUpdateItems(parsed, data);
    res.status(200).json({ requested: [...new Set(parsed)].length, updated });
  } catch (error) {
    if (error instanceof DivisiTidakDikenalError || (error as { code?: string })?.code === "DIVISI_TIDAK_DIKENAL") {
      return res.status(400).json({ message: "Divisi tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal edit massal item", error });
  }
}
