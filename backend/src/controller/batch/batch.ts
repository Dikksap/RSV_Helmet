import type { Request, Response } from "express";
import {
  getAllBatch,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from "../../model/batch/batch.js";

// GET /api/batches
export async function getBatchHandler(_req: Request, res: Response) {
  try {
    const rows = await getAllBatch();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data batch", error });
  }
}

// GET /api/batches/:id
export async function getBatchDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const row = await getBatchById(id);
    if (!row) {
      return res.status(404).json({ message: "Batch tidak ditemukan" });
    }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data batch", error });
  }
}

function parseCreateBody(body: unknown): { kapasitas?: number } | { error: string } {
  const { kapasitas } = (body ?? {}) as { kapasitas?: unknown };
  if (kapasitas !== undefined && (!Number.isInteger(kapasitas) || (kapasitas as number) < 0)) {
    return { error: "Field 'kapasitas' harus bilangan bulat >= 0" };
  }
  return kapasitas === undefined ? {} : { kapasitas: kapasitas as number };
}

function parseUpdateBody(body: unknown):
  | { kapasitas?: number; status?: "AKTIF" | "SELESAI" }
  | { error: string } {
  const { kapasitas, status } = (body ?? {}) as { kapasitas?: unknown; status?: unknown };
  if (kapasitas !== undefined && (!Number.isInteger(kapasitas) || (kapasitas as number) < 0)) {
    return { error: "Field 'kapasitas' harus bilangan bulat >= 0" };
  }
  if (status !== undefined && status !== "AKTIF" && status !== "SELESAI") {
    return { error: "Field 'status' harus salah satu: AKTIF, SELESAI" };
  }
  return {
    ...(kapasitas === undefined ? {} : { kapasitas: kapasitas as number }),
    ...(status === undefined ? {} : { status: status as "AKTIF" | "SELESAI" }),
  };
}

// POST /api/batches
export async function createBatchHandler(req: Request, res: Response) {
  try {
    const parsed = parseCreateBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await createBatch(parsed);
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nomor batch sudah dipakai" });
    }
    res.status(500).json({ message: "Gagal membuat batch", error });
  }
}

// PUT /api/batches/:id
export async function updateBatchHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const parsed = parseUpdateBody(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const row = await updateBatch(id, parsed);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Batch tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate batch", error });
  }
}

// DELETE /api/batches/:id
export async function deleteBatchHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteBatch(id);
    res.status(200).json({ message: "Batch berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Batch tidak ditemukan" });
    }
    if (error?.code === "E409") {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Gagal menghapus batch", error });
  }
}
