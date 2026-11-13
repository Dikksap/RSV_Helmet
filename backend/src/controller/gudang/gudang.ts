import type { Request, Response } from "express";
import {
  createGudang,
  deactivateGudang,
  listGudang,
  setGudangJenis,
  updateGudang,
} from "../../model/gudang/gudang.js";
import { barangScope } from "../barang/helpers.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isUniqueError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

// GET /api/gudang
export async function listGudangHandler(req: Request, res: Response) {
  try {
    res.status(200).json(await listGudang(barangScope(req)));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data gudang", error });
  }
}

// POST /api/gudang
export async function createGudangHandler(req: Request, res: Response) {
  const kode = typeof req.body?.kode === "string" ? req.body.kode.trim().toUpperCase() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const isActive = req.body?.isActive;
  if (!kode || kode.length > 50) {
    return res.status(400).json({ message: "Field 'kode' wajib diisi dan maksimal 50 karakter" });
  }
  if (!name || name.length > 191) {
    return res.status(400).json({ message: "Field 'name' wajib diisi dan maksimal 191 karakter" });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ message: "Field 'isActive' harus boolean" });
  }
  try {
    return res.status(201).json(await createGudang({ kode, name, isActive }));
  } catch (error) {
    if (isUniqueError(error)) return res.status(409).json({ message: "Kode gudang sudah digunakan" });
    return res.status(500).json({ message: "Gagal menambahkan gudang", error });
  }
}

// PUT /api/gudang/:id
export async function updateGudangHandler(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
  const { kode: rawKode, name: rawName, isActive } = req.body ?? {};
  const data: { kode?: string; name?: string; isActive?: boolean } = {};
  if (rawKode !== undefined) {
    if (typeof rawKode !== "string" || !rawKode.trim() || rawKode.trim().length > 50) {
      return res.status(400).json({ message: "Field 'kode' wajib diisi dan maksimal 50 karakter" });
    }
    data.kode = rawKode.trim().toUpperCase();
  }
  if (rawName !== undefined) {
    if (typeof rawName !== "string" || !rawName.trim() || rawName.trim().length > 191) {
      return res.status(400).json({ message: "Field 'name' wajib diisi dan maksimal 191 karakter" });
    }
    data.name = rawName.trim();
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "Field 'isActive' harus boolean" });
    }
    data.isActive = isActive;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Minimal satu field gudang harus diubah" });
  }
  try {
    return res.status(200).json(await updateGudang(id, data));
  } catch (error) {
    if (isUniqueError(error)) return res.status(409).json({ message: "Kode gudang sudah digunakan" });
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "Gudang tidak ditemukan" });
    }
    return res.status(500).json({ message: "Gagal mengubah gudang", error });
  }
}

// DELETE /api/gudang/:id — gudang dinonaktifkan agar riwayat stok tetap terjaga.
export async function deleteGudangHandler(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
  try {
    const gudang = await deactivateGudang(id);
    return res.status(200).json({
      message: `Gudang ${gudang.kode} dinonaktifkan. Riwayat dan saldo lama tetap disimpan.`,
      gudang,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "Gudang tidak ditemukan" });
    }
    return res.status(500).json({ message: "Gagal menonaktifkan gudang", error });
  }
}

// PUT /api/gudang/:id/jenis — atur jenis item yang boleh disimpan.
export async function setGudangJenisHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const raw = (req.body ?? {}).jenis;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ message: "Field 'jenis' harus array string" });
    }
    const jenis = [...new Set(
      raw.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean),
    )];
    if (jenis.length > 50 || jenis.some((value) => value.length > 50)) {
      return res.status(400).json({ message: "Maksimal 50 jenis, masing-masing 50 karakter" });
    }
    const row = await setGudangJenis(id, jenis);
    if (!row) return res.status(404).json({ message: "Gudang tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengatur jenis gudang", error });
  }
}
