import type { Request, Response } from "express";
import {
  listGudang,
  getGudangById,
  createGudang,
  updateGudang,
  deleteGudang,
} from "../../model/gudang/gudang.js";
import { barangScope } from "../barang/helpers.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/gudang
export async function listGudangHandler(req: Request, res: Response) {
  try {
    res.status(200).json(await listGudang(barangScope(req)));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data gudang", error });
  }
}

// GET /api/gudang/:id
export async function getGudangDetail(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getGudangById(id, barangScope(req));
    if (!row) return res.status(404).json({ message: "Gudang tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data gudang", error });
  }
}

// POST /api/gudang
export async function createGudangHandler(req: Request, res: Response) {
  try {
    const { kode, name, isActive } = (req.body ?? {}) as Record<string, unknown>;
    if (!kode || typeof kode !== "string" || !kode.trim()) {
      return res.status(400).json({ message: "Field 'kode' wajib diisi" });
    }
    if (kode.trim().length > 30) return res.status(400).json({ message: "Field 'kode' maksimal 30 karakter" });
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Field 'name' wajib diisi" });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({ message: "Field 'isActive' harus boolean" });
    }
    const row = await createGudang({
      kode: kode.trim().toUpperCase(),
      name: (name as string).trim(),
      ...(isActive !== undefined ? { isActive } : {}),
    });
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode gudang sudah dipakai" });
    res.status(500).json({ message: "Gagal membuat gudang", error });
  }
}

// PUT /api/gudang/:id
export async function updateGudangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { kode, name, isActive } = (req.body ?? {}) as Record<string, unknown>;
    if (kode === undefined && name === undefined && isActive === undefined) {
      return res.status(400).json({ message: "Minimal satu field: kode, name, isActive" });
    }
    const data: { kode?: string; name?: string; isActive?: boolean } = {};
    if (kode !== undefined) {
      if (typeof kode !== "string" || !kode.trim()) return res.status(400).json({ message: "Field 'kode' tidak boleh kosong" });
      if (kode.trim().length > 30) return res.status(400).json({ message: "Field 'kode' maksimal 30 karakter" });
      data.kode = kode.trim().toUpperCase();
    }
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) return res.status(400).json({ message: "Field 'name' tidak boleh kosong" });
      data.name = name.trim();
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "Field 'isActive' harus boolean" });
      data.isActive = isActive;
    }
    const row = await updateGudang(id, data);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Gudang tidak ditemukan" });
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode gudang sudah dipakai" });
    res.status(500).json({ message: "Gagal mengupdate gudang", error });
  }
}

// DELETE /api/gudang/:id — barang ikut SetNull, riwayat mutasi tetap tersimpan
export async function deleteGudangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteGudang(id);
    res.status(200).json({ message: "Gudang berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Gudang tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus gudang", error });
  }
}
