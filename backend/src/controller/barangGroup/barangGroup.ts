import type { Request, Response } from "express";
import {
  getAllBarangGroup,
  getBarangGroupById,
  createBarangGroup,
  updateBarangGroup,
  deleteBarangGroup,
  assignBarangToGroup,
  unassignBarangFromGroup,
} from "../../model/barangGroup/barangGroup.js";

function parseId(raw: unknown): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseBarangIds(body: unknown): { ids: number[] } | { error: string } {
  const raw = (body as { barangIds?: unknown })?.barangIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Field 'barangIds' wajib berupa array yang tidak kosong" };
  }
  const ids: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) {
      return { error: "Setiap 'barangIds' harus angka bulat positif" };
    }
    ids.push(n);
  }
  return { ids: [...new Set(ids)] };
}

// GET /api/barang-group
export async function getBarangGroupListHandler(_req: Request, res: Response) {
  try {
    const data = await getAllBarangGroup();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data grup barang", error });
  }
}

// GET /api/barang-group/:id
export async function getBarangGroupDetailHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getBarangGroupById(id);
    if (!row) return res.status(404).json({ message: "Grup barang tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data grup barang", error });
  }
}

// POST /api/barang-group
export async function createBarangGroupHandler(req: Request, res: Response) {
  try {
    const { nama } = req.body;
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const row = await createBarangGroup({ nama: nama.trim() });
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama grup barang sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat grup barang", error });
  }
}

// PUT /api/barang-group/:id
export async function updateBarangGroupHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { nama } = req.body;
    if (nama === undefined) return res.status(400).json({ message: "Tidak ada field untuk diupdate" });
    if (typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' tidak boleh kosong" });
    }
    const row = await updateBarangGroup(id, { nama: nama.trim() });
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Nama grup barang sudah ada" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Grup barang tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate grup barang", error });
  }
}

// DELETE /api/barang-group/:id
export async function deleteBarangGroupHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteBarangGroup(id);
    res.status(200).json({ message: "Grup barang berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "Grup barang tidak ditemukan" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "Grup masih dipakai barang, tidak dapat dihapus" });
    }
    res.status(500).json({ message: "Gagal menghapus grup barang", error });
  }
}

// POST /api/barang-group/:id/assign
export async function assignBarangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const parsed = parseBarangIds(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });

    const group = await getBarangGroupById(id);
    if (!group) return res.status(404).json({ message: "Grup barang tidak ditemukan" });

    const result = await assignBarangToGroup(id, parsed.ids);
    res.status(200).json({ message: "Barang berhasil dimasukkan ke grup", ...result });
  } catch (error) {
    res.status(500).json({ message: "Gagal memasukkan barang ke grup", error });
  }
}

// POST /api/barang-group/:id/unassign
export async function unassignBarangHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const parsed = parseBarangIds(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });

    const group = await getBarangGroupById(id);
    if (!group) return res.status(404).json({ message: "Grup barang tidak ditemukan" });

    const result = await unassignBarangFromGroup(id, parsed.ids);
    res.status(200).json({ message: "Barang berhasil dikeluarkan dari grup", ...result });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengeluarkan barang dari grup", error });
  }
}
