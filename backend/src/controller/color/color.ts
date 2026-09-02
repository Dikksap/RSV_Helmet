import type { Request, Response } from "express";
import {
  getAllColors,
  getColorById,
  createColor,
  updateColor,
  deleteColor,
} from "../../model/color/color.js";

// GET /api/colors
export async function getColorsHandler(_req: Request, res: Response) {
  try {
    const colors = await getAllColors();
    res.status(200).json(colors);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data warna", error });
  }
}

// GET /api/colors/:id
export async function getColorDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const color = await getColorById(id);
    if (!color) {
      return res.status(404).json({ message: "Warna tidak ditemukan" });
    }
    res.status(200).json(color);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data warna", error });
  }
}

// POST /api/colors  (alias warna)
export async function createColorHandler(req: Request, res: Response) {
  try {
    const { nama } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const color = await createColor({ nama: nama.trim() });
    res.status(201).json(color);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama warna sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat warna", error });
  }
}

// PUT /api/colors/:id
export async function updateColorHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const { nama } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const color = await updateColor(id, { nama: nama.trim() });
    res.status(200).json(color);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama warna sudah ada" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Warna tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate warna", error });
  }
}

// DELETE /api/colors/:id
export async function deleteColorHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteColor(id);
    res.status(200).json({ message: "Warna berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Warna tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "Warna masih dipakai variant, tidak dapat dihapus" });
    }
    res.status(500).json({ message: "Gagal menghapus warna", error });
  }
}
