import type { Request, Response } from "express";
import {
  getAllStatusBarang,
  getStatusBarangById,
  createStatusBarang,
  updateStatusBarang,
  deleteStatusBarang,
} from "../../model/statusBarang/statusBarang.js";

const KODE_RE = /^[A-Z][A-Z0-9_]*$/;

function validateKode(kode: unknown): string | null {
  if (!kode || typeof kode !== "string" || !kode.trim()) return "Field 'kode' wajib diisi";
  const v = kode.trim().toUpperCase();
  if (v.length > 30) return "Field 'kode' maksimal 30 karakter";
  if (!KODE_RE.test(v)) return "Field 'kode' harus huruf kapital, angka, underscore, diawali huruf";
  return null;
}

// GET /api/status-barang
export async function getStatusBarangHandler(req: Request, res: Response) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const data = await getAllStatusBarang(includeInactive);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data status barang", error });
  }
}

// GET /api/status-barang/:id
export async function getStatusBarangDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const row = await getStatusBarangById(id);
    if (!row) return res.status(404).json({ message: "Status barang tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data status barang", error });
  }
}

// POST /api/status-barang
export async function createStatusBarangHandler(req: Request, res: Response) {
  try {
    const { kode, nama, warna, urutan, isActive } = req.body;
    const kodeErr = validateKode(kode);
    if (kodeErr) return res.status(400).json({ message: kodeErr });
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const row = await createStatusBarang({
      kode: kode.trim().toUpperCase(),
      nama: nama.trim(),
      warna: warna ?? null,
      urutan: urutan !== undefined ? Number(urutan) : 0,
      isActive: isActive ?? true,
    });
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kode status sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat status barang", error });
  }
}

// PUT /api/status-barang/:id
export async function updateStatusBarangHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const { kode, nama, warna, urutan, isActive } = req.body;
    const data: any = {};
    if (kode !== undefined) {
      const kodeErr = validateKode(kode);
      if (kodeErr) return res.status(400).json({ message: kodeErr });
      data.kode = kode.trim().toUpperCase();
    }
    if (nama !== undefined) {
      if (!nama || typeof nama !== "string" || !nama.trim()) {
        return res.status(400).json({ message: "Field 'nama' tidak boleh kosong" });
      }
      data.nama = nama.trim();
    }
    if (warna !== undefined) data.warna = warna;
    if (urutan !== undefined) data.urutan = Number(urutan);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Tidak ada field untuk diupdate" });
    }

    const row = await updateStatusBarang(id, data);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kode status sudah ada" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Status barang tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate status barang", error });
  }
}

// DELETE /api/status-barang/:id
export async function deleteStatusBarangHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteStatusBarang(id);
    res.status(200).json({ message: "Status barang berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Status barang tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "Status masih dipakai barang/riwayat, tidak dapat dihapus" });
    }
    res.status(500).json({ message: "Gagal menghapus status barang", error });
  }
}
