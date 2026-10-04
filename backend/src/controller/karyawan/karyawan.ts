import type { Request, Response } from "express";
import {
  getAllKaryawan,
  getKaryawanById,
  createKaryawan,
  updateKaryawan,
  deleteKaryawan,
} from "../../model/karyawan/karyawan.js";

// GET /api/karyawan
export async function getKaryawanHandler(_req: Request, res: Response) {
  try {
    const rows = await getAllKaryawan();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data karyawan", error });
  }
}

// GET /api/karyawan/:id
export async function getKaryawanDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const row = await getKaryawanById(id);
    if (!row) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data karyawan", error });
  }
}

function parseBody(body: unknown): { nama: string; jabatan: string; divisiId?: number | null } | { error: string } {
  const { nama, jabatan, divisiId } = (body ?? {}) as { nama?: unknown; jabatan?: unknown; divisiId?: unknown };
  if (!nama || typeof nama !== "string" || !nama.trim()) {
    return { error: "Field 'nama' wajib diisi" };
  }
  if (!jabatan || typeof jabatan !== "string" || !jabatan.trim()) {
    return { error: "Field 'jabatan' wajib diisi" };
  }
  if (divisiId !== undefined && divisiId !== null && (!Number.isInteger(divisiId) || (divisiId as number) <= 0)) {
    return { error: "Field 'divisiId' harus angka bulat positif atau null" };
  }
  return { nama: nama.trim(), jabatan: jabatan.trim(), ...(divisiId === undefined ? {} : { divisiId: divisiId as number | null }) };
}

// POST /api/karyawan
export async function createKaryawanHandler(req: Request, res: Response) {
  try {
    const parsed = parseBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await createKaryawan(parsed);
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2003") {
      return res.status(404).json({ message: "Divisi tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal membuat karyawan", error });
  }
}

// PUT /api/karyawan/:id
export async function updateKaryawanHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const parsed = parseBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await updateKaryawan(id, parsed);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(404).json({ message: "Divisi tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate karyawan", error });
  }
}

// DELETE /api/karyawan/:id
export async function deleteKaryawanHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteKaryawan(id);
    res.status(200).json({ message: "Karyawan berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal menghapus karyawan", error });
  }
}
