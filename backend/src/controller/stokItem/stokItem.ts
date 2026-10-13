import type { Request, Response } from "express";
import { getItemById } from "../../model/item/item.js";
import { catatMutasi, getSaldo, getSaldoBulk, listMutasiItem } from "../../model/stokItem/stokItem.js";
import prisma from "../../lib/prisma.js";
import { TipeStokItem } from "../../../generated/prisma/enums.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/items/:id/stok  body: { jumlah, keterangan? }  (catat stok MASUK manual)
export async function tambahStokHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { jumlah, keterangan } = (req.body ?? {}) as { jumlah?: unknown; keterangan?: unknown };
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "Field 'jumlah' harus bilangan bulat lebih dari 0" });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });

    const row = await prisma.$transaction(async (tx) => {
      const mutasi = await catatMutasi(tx, {
        itemId: id,
        tipe: TipeStokItem.MASUK,
        jumlah: n,
        keterangan: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : "Input stok manual",
        userId: req.user?.id ?? null,
      });
      const saldo = await getSaldo(id, tx);
      return { mutasi, saldo };
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mencatat stok item", error });
  }
}

// POST /api/items/stok-saldo  body: { ids: number[] }  -> { saldo: Record<id, number> }
export async function getSaldoBulkHandler(req: Request, res: Response) {
  try {
    const { ids } = (req.body ?? {}) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
      return res.status(400).json({ message: "Field 'ids' harus array 1-200 id" });
    }
    const parsed = ids.map(Number);
    if (parsed.some((n) => !Number.isInteger(n) || n <= 0)) {
      return res.status(400).json({ message: "Field 'ids' harus berisi angka bulat positif" });
    }
    res.status(200).json({ saldo: await getSaldoBulk(parsed) });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil saldo item", error });
  }
}

// GET /api/items/:id/stok?page&limit  -> saldo + riwayat mutasi
export async function getStokItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [saldo, riwayat] = await Promise.all([getSaldo(id), listMutasiItem(id, page, limit)]);
    res.status(200).json({ item, saldo, riwayat });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil stok item", error });
  }
}
