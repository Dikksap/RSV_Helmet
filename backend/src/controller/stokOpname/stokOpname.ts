import type { Request, Response } from "express";
import {
  buatSesiOpname,
  getSesiOpnameById,
  listSesiOpname,
  OPNAME_MAKS_BARIS,
} from "../../model/stokOpname/stokOpname.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/stok-opname  body: { items: [{ itemId, stokFisik }], keterangan? }
export async function buatSesiOpnameHandler(req: Request, res: Response) {
  try {
    const { items, keterangan } = (req.body ?? {}) as { items?: unknown; keterangan?: unknown };
    if (!Array.isArray(items) || items.length === 0 || items.length > OPNAME_MAKS_BARIS) {
      return res.status(400).json({ message: `Field 'items' harus array 1-${OPNAME_MAKS_BARIS} baris` });
    }
    const baris: { itemId: number; stokFisik: number }[] = [];
    const dilihat = new Set<number>();
    for (const raw of items) {
      const row = (raw ?? {}) as { itemId?: unknown; stokFisik?: unknown };
      const itemId = Number(row.itemId);
      const stokFisik = Number(row.stokFisik);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ message: "items[].itemId harus angka bulat positif" });
      }
      if (!Number.isInteger(stokFisik) || stokFisik < 0) {
        return res.status(400).json({ message: "items[].stokFisik harus bilangan bulat >= 0" });
      }
      if (dilihat.has(itemId)) {
        return res.status(400).json({ message: `Item ${itemId} duplikat dalam satu sesi` });
      }
      dilihat.add(itemId);
      baris.push({ itemId, stokFisik });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    try {
      const sesi = await buatSesiOpname(
        baris,
        typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : null,
        req.user?.id ?? null,
      );
      res.status(201).json(sesi);
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2003") {
        return res.status(404).json({ message: "Salah satu item tidak ditemukan" });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan sesi opname", error });
  }
}

// GET /api/stok-opname?page&limit
export async function listSesiOpnameHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    res.status(200).json(await listSesiOpname(page, limit));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil sesi opname", error });
  }
}

// GET /api/stok-opname/:id
export async function getSesiOpnameHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getSesiOpnameById(id);
    if (!row) return res.status(404).json({ message: "Sesi opname tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil sesi opname", error });
  }
}
