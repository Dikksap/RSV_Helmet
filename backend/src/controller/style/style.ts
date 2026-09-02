import type { Request, Response } from "express";
import {
  getAllStyles,
  getStyleById,
  createStyle,
  updateStyle,
  deleteStyle,
} from "../../model/style/style.js";

// GET /api/styles
export async function getStylesHandler(_req: Request, res: Response) {
  try {
    const styles = await getAllStyles();
    res.status(200).json(styles);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data style", error });
  }
}

// GET /api/styles/:id
export async function getStyleDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const style = await getStyleById(id);
    if (!style) {
      return res.status(404).json({ message: "Style tidak ditemukan" });
    }
    res.status(200).json(style);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data style", error });
  }
}

// POST /api/styles
export async function createStyleHandler(req: Request, res: Response) {
  try {
    const { nama } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const style = await createStyle({ nama: nama.trim() });
    res.status(201).json(style);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama style sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat style", error });
  }
}

// PUT /api/styles/:id
export async function updateStyleHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const { nama } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const style = await updateStyle(id, { nama: nama.trim() });
    res.status(200).json(style);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama style sudah ada" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Style tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate style", error });
  }
}

// DELETE /api/styles/:id
export async function deleteStyleHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteStyle(id);
    res.status(200).json({ message: "Style berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Style tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "Style masih dipakai variant, tidak dapat dihapus" });
    }
    res.status(500).json({ message: "Gagal menghapus style", error });
  }
}
