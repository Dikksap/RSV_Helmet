import type { Request, Response } from "express";
import { getItemById } from "../../model/item/item.js";
import { catatMutasi, getSaldo, getSaldoBulk, getRingkasanBulk, listMutasiItem, lockItem, StokKurangError } from "../../model/stokItem/stokItem.js";
import {
  getItemWarehouseBalances,
  getWarehouseItemBalances,
  InventoryError,
  transferItemBetweenWarehouses,
} from "../../model/inventory/inventory.js";
import prisma from "../../lib/prisma.js";
import { TipeStokItem } from "../../../generated/prisma/enums.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isTanggalMasaDepan(tanggal: Date): boolean {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  return tanggal > hariIni;
}

// POST /api/items/:id/stok  body: { jumlah, keterangan?, tanggal? }  (catat stok MASUK manual)
export async function tambahStokHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { jumlah, keterangan, tanggal } = (req.body ?? {}) as { jumlah?: unknown; keterangan?: unknown; tanggal?: unknown };
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "Field 'jumlah' harus bilangan bulat lebih dari 0" });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    let tanggalTransaksi: Date | undefined;
    if (tanggal !== undefined && tanggal !== null && tanggal !== "") {
      const parsed = parseTanggalFilter(tanggal);
      if (!parsed) return res.status(400).json({ message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD)" });
      if (isTanggalMasaDepan(parsed)) return res.status(400).json({ message: "Field 'tanggal' tidak boleh melebihi hari ini" });
      tanggalTransaksi = parsed;
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
        ...(tanggalTransaksi ? { tanggal: tanggalTransaksi } : {}),
      });
      const saldo = await getSaldo(id, tx);
      return { mutasi, saldo };
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mencatat stok item", error });
  }
}

// POST /api/items/:id/stok/keluar  body: { jumlah, keterangan?, tanggal? }  (catat stok KELUAR manual)
// Lock baris Item + cek saldo + insert dalam satu transaksi: ledger tidak boleh minus.
// Cek saldo memakai total saat ini; tanggal kustom hanya menentukan tanggal bisnis mutasi.
export async function keluarStokHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { jumlah, keterangan, tanggal } = (req.body ?? {}) as { jumlah?: unknown; keterangan?: unknown; tanggal?: unknown };
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "Field 'jumlah' harus bilangan bulat lebih dari 0" });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    let tanggalTransaksi: Date | undefined;
    if (tanggal !== undefined && tanggal !== null && tanggal !== "") {
      const parsed = parseTanggalFilter(tanggal);
      if (!parsed) return res.status(400).json({ message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD)" });
      if (isTanggalMasaDepan(parsed)) return res.status(400).json({ message: "Field 'tanggal' tidak boleh melebihi hari ini" });
      tanggalTransaksi = parsed;
    }
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });

    const row = await prisma.$transaction(async (tx) => {
      await lockItem(tx, id);
      const saldoSebelum = await getSaldo(id, tx);
      if (n > saldoSebelum) throw new StokKurangError(id, saldoSebelum);
      const mutasi = await catatMutasi(tx, {
        itemId: id,
        tipe: TipeStokItem.KELUAR,
        jumlah: n,
        keterangan: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : "Keluar manual",
        userId: req.user?.id ?? null,
        ...(tanggalTransaksi ? { tanggal: tanggalTransaksi } : {}),
      });
      const saldo = await getSaldo(id, tx);
      return { mutasi, saldo };
    });
    res.status(201).json(row);
  } catch (error) {
    if (error instanceof StokKurangError) {
      return res.status(409).json({ message: `Jumlah melebihi saldo (tersedia ${error.tersedia})`, code: error.code, tersedia: error.tersedia });
    }
    res.status(500).json({ message: "Gagal mencatat stok keluar", error });
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

// POST /api/items/stok-saldo-gudang body: { ids: number[] } -> aggregate balance in active warehouses only.
export async function getSaldoGudangBulkHandler(req: Request, res: Response) {
  try {
    const { ids } = (req.body ?? {}) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
      return res.status(400).json({ message: "Field 'ids' harus array 1-200 id" });
    }
    const parsed = ids.map(Number);
    if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ message: "Field 'ids' harus berisi angka bulat positif" });
    }
    res.status(200).json({ saldo: await getWarehouseItemBalances(parsed) });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil saldo item di gudang", error });
  }
}

// GET /api/items/:id/stok/gudang — saldo per gudang aktif dari StockBalance.
export async function getItemWarehouseBalancesHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    return res.status(200).json(await getItemWarehouseBalances(id));
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil saldo item per gudang", error });
  }
}

// POST /api/items/:id/stok/transfer — transfer stok item antargudang.
export async function transferItemWarehouseHandler(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });

  const fromLocationId = parseId(String(req.body?.fromLocationId ?? ""));
  const toLocationId = parseId(String(req.body?.toLocationId ?? ""));
  const quantity =
    typeof req.body?.quantity === "number" ||
    (typeof req.body?.quantity === "string" && req.body.quantity.trim() !== "")
      ? Number(req.body.quantity)
      : Number.NaN;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const idempotencyKey =
    typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : "";

  if (!fromLocationId || !toLocationId) {
    return res.status(400).json({ message: "fromLocationId dan toLocationId harus angka bulat positif" });
  }
  if (fromLocationId === toLocationId) {
    return res.status(400).json({ message: "Gudang asal dan tujuan harus berbeda" });
  }
  const scaledQuantity = quantity * 1_000_000;
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isSafeInteger(Math.round(scaledQuantity)) ||
    Math.abs(scaledQuantity - Math.round(scaledQuantity)) > 1e-7
  ) {
    return res.status(400).json({ message: "quantity harus positif dengan maksimal 6 angka desimal" });
  }
  if (reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ message: "Alasan transfer wajib diisi (3-500 karakter)" });
  }
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return res.status(400).json({ message: "idempotencyKey wajib diisi dan maksimal 128 karakter" });
  }
  if (!req.user?.id) return res.status(401).json({ message: "Token tidak ditemukan" });

  try {
    const result = await transferItemBetweenWarehouses({
      itemId: id,
      fromLocationId,
      toLocationId,
      quantity,
      idempotencyKey,
      reason,
      userId: req.user.id,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof InventoryError) {
      const status = error.code === "INSUFFICIENT_STOCK" || error.code === "IDEMPOTENCY_CONFLICT"
        ? 409
        : error.code === "ITEM_NOT_FOUND" || error.code === "LOCATION_NOT_FOUND"
          ? 404
          : error.code === "SCOPE_DENIED"
            ? 403
            : 400;
      return res.status(status).json({ code: error.code, message: error.message });
    }
    return res.status(500).json({ message: "Gagal mentransfer stok item", error });
  }
}

// POST /api/items/stok-ringkasan  body: { ids: number[], dari?, sampai? }
// Ringkasan Masuk/Keluar/Net per periode untuk daftar Kelola Item. Saldo aktual tetap dari /stok-saldo.
export async function getRingkasanBulkHandler(req: Request, res: Response) {
  try {
    const { ids, dari: dariRaw, sampai: sampaiRaw } = (req.body ?? {}) as { ids?: unknown; dari?: unknown; sampai?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
      return res.status(400).json({ message: "Field 'ids' harus array 1-200 id" });
    }
    const parsedIds = ids.map(Number);
    if (parsedIds.some((n) => !Number.isInteger(n) || n <= 0)) {
      return res.status(400).json({ message: "Field 'ids' harus berisi angka bulat positif" });
    }
    let dari: Date | undefined;
    if (dariRaw !== undefined && dariRaw !== null && dariRaw !== "") {
      const parsed = parseTanggalFilter(dariRaw);
      if (!parsed) return res.status(400).json({ message: "Field 'dari' harus tanggal valid (YYYY-MM-DD)" });
      dari = parsed;
    }
    let sampai: Date | undefined;
    if (sampaiRaw !== undefined && sampaiRaw !== null && sampaiRaw !== "") {
      const parsed = parseTanggalFilter(sampaiRaw);
      if (!parsed) return res.status(400).json({ message: "Field 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      sampai = parsed;
    }
    if (dari && sampai && dari > sampai) {
      return res.status(400).json({ message: "Field 'dari' tidak boleh lebih besar dari 'sampai'" });
    }
    res.status(200).json({ ringkasan: await getRingkasanBulk(parsedIds, { dari, sampai }) });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil ringkasan stok item", error });
  }
}

function parseTanggalFilter(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// GET /api/items/:id/stok?page&limit&dari&sampai  -> saldo + riwayat mutasi
export async function getStokItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    let dari: Date | undefined;
    if (req.query.dari !== undefined && req.query.dari !== "") {
      const parsed = parseTanggalFilter(req.query.dari);
      if (!parsed) return res.status(400).json({ message: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" });
      dari = parsed;
    }
    let sampai: Date | undefined;
    if (req.query.sampai !== undefined && req.query.sampai !== "") {
      const parsed = parseTanggalFilter(req.query.sampai);
      if (!parsed) return res.status(400).json({ message: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      sampai = parsed;
    }
    if (dari && sampai && dari > sampai) {
      return res.status(400).json({ message: "Query 'dari' tidak boleh lebih besar dari 'sampai'" });
    }
    const [saldo, riwayat] = await Promise.all([getSaldo(id), listMutasiItem(id, page, limit, { dari, sampai })]);
    res.status(200).json({ item, saldo, riwayat });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil stok item", error });
  }
}
