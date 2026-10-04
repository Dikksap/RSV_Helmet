import type { Request, Response } from "express";
import {
  getAllDivisi,
  getDivisiById,
  createDivisi,
  updateDivisi,
  deleteDivisi,
} from "../../model/divisi/divisi.js";

// GET /api/divisi
export async function getDivisiHandler(_req: Request, res: Response) {
  try {
    const rows = await getAllDivisi();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data divisi", error });
  }
}

// GET /api/divisi/:id
export async function getDivisiDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const row = await getDivisiById(id);
    if (!row) {
      return res.status(404).json({ message: "Divisi tidak ditemukan" });
    }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data divisi", error });
  }
}

function parseBody(body: unknown): { nama: string } | { error: string } {
  const { nama } = (body ?? {}) as { nama?: unknown };
  if (!nama || typeof nama !== "string" || !nama.trim()) {
    return { error: "Field 'nama' wajib diisi" };
  }
  return { nama: nama.trim() };
}

// POST /api/divisi
export async function createDivisiHandler(req: Request, res: Response) {
  try {
    const parsed = parseBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await createDivisi(parsed);
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama divisi sudah dipakai" });
    }
    res.status(500).json({ message: "Gagal membuat divisi", error });
  }
}

// PUT /api/divisi/:id
export async function updateDivisiHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const parsed = parseBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await updateDivisi(id, parsed);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Divisi tidak ditemukan" });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama divisi sudah dipakai" });
    }
    res.status(500).json({ message: "Gagal mengupdate divisi", error });
  }
}

// DELETE /api/divisi/:id
export async function deleteDivisiHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteDivisi(id);
    res.status(200).json({ message: "Divisi berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Divisi tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal menghapus divisi", error });
  }
}
