import type { Request, Response } from "express";
import {
  getAllSizes,
  getSizeById,
  createSize,
  updateSize,
  deleteSize,
} from "../../model/size/size.js";

// GET /api/sizes
export async function getSizesHandler(_req: Request, res: Response) {
  try {
    const sizes = await getAllSizes();
    res.status(200).json(sizes);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data ukuran", error });
  }
}

// GET /api/sizes/:id
export async function getSizeDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const size = await getSizeById(id);
    if (!size) {
      return res.status(404).json({ message: "Ukuran tidak ditemukan" });
    }
    res.status(200).json(size);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data ukuran", error });
  }
}

// POST /api/sizes
export async function createSizeHandler(req: Request, res: Response) {
  try {
    const { nama, urutan } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    if (urutan !== undefined && (!Number.isInteger(Number(urutan)) || Number(urutan) < 0)) {
      return res.status(400).json({ message: "Field 'urutan' harus angka bulat >= 0" });
    }
    const size = await createSize({
      nama: nama.trim(),
      urutan: urutan !== undefined ? Number(urutan) : undefined,
    });
    res.status(201).json(size);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama ukuran sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat ukuran", error });
  }
}

// PUT /api/sizes/:id
export async function updateSizeHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const { nama, urutan } = req.body;
    if (nama !== undefined && (typeof nama !== "string" || !nama.trim())) {
      return res.status(400).json({ message: "Field 'nama' tidak valid" });
    }
    if (urutan !== undefined && (!Number.isInteger(Number(urutan)) || Number(urutan) < 0)) {
      return res.status(400).json({ message: "Field 'urutan' harus angka bulat >= 0" });
    }
    if (nama === undefined && urutan === undefined) {
      return res.status(400).json({ message: "Minimal satu field 'nama' atau 'urutan' wajib diisi" });
    }
    const data: { nama?: string; urutan?: number } = {};
    if (nama !== undefined) data.nama = nama.trim();
    if (urutan !== undefined) data.urutan = Number(urutan);
    const size = await updateSize(id, data);
    res.status(200).json(size);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama ukuran sudah ada" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Ukuran tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate ukuran", error });
  }
}

// DELETE /api/sizes/:id
export async function deleteSizeHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteSize(id);
    res.status(200).json({ message: "Ukuran berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Ukuran tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "Ukuran masih dipakai variant, tidak dapat dihapus" });
    }
    res.status(500).json({ message: "Gagal menghapus ukuran", error });
  }
}
