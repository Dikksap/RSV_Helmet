import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getItemById } from "../../model/item/item.js";
import { lockItem, StokKurangError } from "../../model/stokItem/stokItem.js";
import {
  getInventoryItemSummary,
  getInventoryItemTotals,
  getItemStockAtLocation,
  getItemStockTotal,
  getItemWarehouseBalances,
  getWarehouseItemBalances,
  InventoryError,
  postInventoryMovementInTransaction,
  transferItemBetweenWarehouses,
} from "../../model/inventory/inventory.js";
import prisma from "../../lib/prisma.js";
import { awalHariBisnis, parseTanggalBisnis } from "../../lib/tanggalBisnis.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isTanggalMasaDepan(tanggal: Date): boolean {
  const hariIni = awalHariBisnis(new Date());
  return tanggal > hariIni;
}

type MutasiView = {
  id: number;
  itemId: number;
  tipe: "MASUK" | "KELUAR";
  jumlah: number;
  sumberPermintaanItemId: number | null;
  keterangan: string | null;
  userId: number | null;
  tanggal: string;
  sumber: "INVENTORY" | "LEGACY";
};

function movementToMutasi(movement: {
  id: bigint | number;
  itemId: number | null;
  fromLocationId: number | null;
  toLocationId: number | null;
  quantity: unknown;
  reason: string | null;
  userId: number | null;
  occurredAt: Date;
}): MutasiView {
  const masuk = movement.toLocationId !== null && movement.fromLocationId === null;
  return {
    // id negatif = baris ledger inventory (hindari tabrakan id dengan ledger legacy)
    id: -Number(movement.id),
    itemId: movement.itemId ?? 0,
    tipe: masuk ? "MASUK" : "KELUAR",
    jumlah: Number(movement.quantity),
    sumberPermintaanItemId: null,
    keterangan: movement.reason,
    userId: movement.userId,
    tanggal: movement.occurredAt.toISOString(),
    sumber: "INVENTORY",
  };
}

function legacyToMutasi(row: {
  id: number;
  itemId: number;
  tipe: string;
  jumlah: unknown;
  sumberPermintaanItemId: number | null;
  keterangan: string | null;
  userId: number | null;
  tanggal: Date;
}): MutasiView {
  return {
    id: row.id,
    itemId: row.itemId,
    tipe: row.tipe === "MASUK" ? "MASUK" : "KELUAR",
    jumlah: Number(row.jumlah),
    sumberPermintaanItemId: row.sumberPermintaanItemId,
    keterangan: row.keterangan,
    userId: row.userId,
    tanggal: row.tanggal.toISOString(),
    sumber: "LEGACY",
  };
}

async function resolveDefaultLocation(item: {
  id: number;
  kode: string;
  defaultInventoryLocationId?: number | null;
}): Promise<number> {
  if (item.defaultInventoryLocationId) return item.defaultInventoryLocationId;
  throw new InventoryError(
    "LOCATION_NOT_FOUND",
    `Item ${item.kode} belum punya lokasi default; atur lokasi default sebelum mencatat stok manual`,
  );
}

// POST /api/items/:id/stok — tambah stok manual (ledger lokasi, bukan L1)
export async function tambahStokHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { jumlah, keterangan, tanggal, idempotencyKey } = (req.body ?? {}) as Record<string, unknown>;
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "Field 'jumlah' harus bilangan bulat lebih dari 0" });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    let tanggalTransaksi: Date | undefined;
    if (tanggal !== undefined && tanggal !== null && tanggal !== "") {
      const parsed = parseTanggalBisnis(tanggal);
      if (!parsed) return res.status(400).json({ message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD)" });
      if (isTanggalMasaDepan(parsed)) return res.status(400).json({ message: "Field 'tanggal' tidak boleh melebihi hari ini" });
      tanggalTransaksi = parsed;
    }
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    const locationId = await resolveDefaultLocation(item);
    const key =
      typeof idempotencyKey === "string" && idempotencyKey.trim().length >= 8
        ? idempotencyKey.trim()
        : `manual-item-in:${randomUUID()}`;

    const row = await prisma.$transaction(async (tx) => {
      await lockItem(tx, id);
      const movement = await postInventoryMovementInTransaction(tx, {
        itemId: id,
        toLocationId: locationId,
        type: "OPENING",
        quantity: n,
        idempotencyKey: key,
        sourceType: "MANUAL_ITEM_IN",
        sourceId: key,
        reason: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : "Input stok manual",
        userId: req.user?.id ?? null,
        ...(tanggalTransaksi ? { occurredAt: tanggalTransaksi } : {}),
      });
      const saldo = await getItemStockTotal(tx, id);
      return { mutasi: movementToMutasi(movement), saldo };
    });
    res.status(201).json(row);
  } catch (error) {
    if (error instanceof InventoryError) {
      return res.status(error.code === "LOCATION_NOT_FOUND" ? 409 : 400).json({ code: error.code, message: error.message });
    }
    res.status(500).json({ message: "Gagal mencatat stok item" });
  }
}

// POST /api/items/:id/stok/keluar — keluar manual (ledger lokasi)
export async function keluarStokHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { jumlah, keterangan, tanggal, idempotencyKey } = (req.body ?? {}) as Record<string, unknown>;
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ message: "Field 'jumlah' harus bilangan bulat lebih dari 0" });
    }
    if (keterangan !== undefined && keterangan !== null && typeof keterangan !== "string") {
      return res.status(400).json({ message: "Field 'keterangan' harus string" });
    }
    let tanggalTransaksi: Date | undefined;
    if (tanggal !== undefined && tanggal !== null && tanggal !== "") {
      const parsed = parseTanggalBisnis(tanggal);
      if (!parsed) return res.status(400).json({ message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD)" });
      if (isTanggalMasaDepan(parsed)) return res.status(400).json({ message: "Field 'tanggal' tidak boleh melebihi hari ini" });
      tanggalTransaksi = parsed;
    }
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    const locationId = await resolveDefaultLocation(item);
    const key =
      typeof idempotencyKey === "string" && idempotencyKey.trim().length >= 8
        ? idempotencyKey.trim()
        : `manual-item-out:${randomUUID()}`;

    const row = await prisma.$transaction(async (tx) => {
      await lockItem(tx, id);
      const tersedia = await getItemStockAtLocation(tx, id, locationId);
      if (n > tersedia) throw new StokKurangError(id, tersedia);
      const movement = await postInventoryMovementInTransaction(tx, {
        itemId: id,
        fromLocationId: locationId,
        type: "ADJUSTMENT",
        quantity: n,
        idempotencyKey: key,
        sourceType: "MANUAL_ITEM_OUT",
        sourceId: key,
        reason: typeof keterangan === "string" && keterangan.trim() ? keterangan.trim() : "Keluar manual",
        userId: req.user?.id ?? null,
        ...(tanggalTransaksi ? { occurredAt: tanggalTransaksi } : {}),
      });
      const saldo = await getItemStockTotal(tx, id);
      return { mutasi: movementToMutasi(movement), saldo };
    });
    res.status(201).json(row);
  } catch (error) {
    if (error instanceof StokKurangError) {
      return res.status(409).json({ message: `Jumlah melebihi saldo (tersedia ${error.tersedia})`, code: error.code, tersedia: error.tersedia });
    }
    if (error instanceof InventoryError) {
      return res.status(error.code === "LOCATION_NOT_FOUND" ? 409 : 400).json({ code: error.code, message: error.message });
    }
    res.status(500).json({ message: "Gagal mencatat stok keluar" });
  }
}

// POST /api/items/stok-saldo — total saldo proyeksi (StockBalance)
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
    res.status(200).json({ saldo: await getInventoryItemTotals(parsed) });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil saldo item" });
  }
}

// POST /api/items/stok-saldo-gudang — saldo per gudang aktif
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
    res.status(500).json({ message: "Gagal mengambil saldo item di gudang" });
  }
}

// GET /api/items/:id/stok/gudang
export async function getItemWarehouseBalancesHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    return res.status(200).json(await getItemWarehouseBalances(id));
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil saldo item per gudang" });
  }
}

// POST /api/items/:id/stok/transfer
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
    return res.status(500).json({ message: "Gagal mentransfer stok item" });
  }
}

// POST /api/items/stok-ringkasan — ringkasan Masuk/Keluar/Net (ledger lokasi, gudang)
export async function getRingkasanBulkHandler(req: Request, res: Response) {
  try {
    const { ids, dari: dariRaw, sampai: sampaiRaw } = (req.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
      return res.status(400).json({ message: "Field 'ids' harus array 1-200 id" });
    }
    const parsedIds = ids.map(Number);
    if (parsedIds.some((n) => !Number.isInteger(n) || n <= 0)) {
      return res.status(400).json({ message: "Field 'ids' harus berisi angka bulat positif" });
    }
    let dari: Date | undefined;
    if (dariRaw !== undefined && dariRaw !== null && dariRaw !== "") {
      const parsed = parseTanggalBisnis(dariRaw);
      if (!parsed) return res.status(400).json({ message: "Field 'dari' harus tanggal valid (YYYY-MM-DD)" });
      dari = parsed;
    }
    let sampai: Date | undefined;
    if (sampaiRaw !== undefined && sampaiRaw !== null && sampaiRaw !== "") {
      const parsed = parseTanggalBisnis(sampaiRaw);
      if (!parsed) return res.status(400).json({ message: "Field 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      sampai = parsed;
    }
    if (dari && sampai && dari > sampai) {
      return res.status(400).json({ message: "Field 'dari' tidak boleh lebih besar dari 'sampai'" });
    }
    const sampaiEksklusif = sampai ? new Date(awalHariBisnis(sampai).getTime() + 86_400_000) : undefined;
    res.status(200).json({
      ringkasan: await getInventoryItemSummary(parsedIds, { from: dari, until: sampaiEksklusif }),
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil ringkasan stok item" });
  }
}

// GET /api/items/:id/stok — saldo proyeksi + riwayat gabungan (legacy + inventory)
export async function getStokItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan" });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    let dari: Date | undefined;
    let sampai: Date | undefined;
    if (req.query.dari !== undefined && req.query.dari !== "") {
      const parsed = parseTanggalBisnis(req.query.dari);
      if (!parsed) return res.status(400).json({ message: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" });
      dari = parsed;
    }
    if (req.query.sampai !== undefined && req.query.sampai !== "") {
      const parsed = parseTanggalBisnis(req.query.sampai);
      if (!parsed) return res.status(400).json({ message: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      sampai = parsed;
    }
    if (dari && sampai && dari > sampai) {
      return res.status(400).json({ message: "Query 'dari' tidak boleh lebih besar dari 'sampai'" });
    }

    const tanggalFilter =
      dari || sampai
        ? {
            ...(dari ? { gte: dari } : {}),
            ...(sampai ? { lt: new Date(awalHariBisnis(sampai).getTime() + 86_400_000) } : {}),
          }
        : undefined;

    // `sumber` memisahkan kartu histori legacy dari baris ledger lokasi.
    // Kosong = gabungan (perilaku lama), LEGACY/INVENTORY = hanya satu sumber.
    const sumberRaw =
      typeof req.query.sumber === "string" ? req.query.sumber.trim().toUpperCase() : "";
    if (sumberRaw && sumberRaw !== "LEGACY" && sumberRaw !== "INVENTORY") {
      return res.status(400).json({ message: "Query 'sumber' harus LEGACY atau INVENTORY" });
    }
    const mauLegacy = sumberRaw === "" || sumberRaw === "LEGACY";
    const mauInventory = sumberRaw === "" || sumberRaw === "INVENTORY";

    // Batas aman: histori lama dapat sangat panjang. `truncated` memberi tahu
    // klien bila ada baris di luar jendela yang ditampilkan.
    const CAP = 1000;
    const [saldo, legacyRows, inventoryRows] = await Promise.all([
      getItemStockTotal(prisma, id),
      mauLegacy
        ? prisma.stokItemMutasi.findMany({
            where: { itemId: id, ...(tanggalFilter ? { tanggal: tanggalFilter } : {}) },
            orderBy: [{ tanggal: "desc" }, { id: "desc" }],
            take: CAP,
          })
        : Promise.resolve([]),
      mauInventory
        ? prisma.inventoryMovement.findMany({
            where: { itemId: id, ...(tanggalFilter ? { occurredAt: tanggalFilter } : {}) },
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            take: CAP,
            select: {
              id: true,
              itemId: true,
              fromLocationId: true,
              toLocationId: true,
              quantity: true,
              reason: true,
              userId: true,
              occurredAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const merged = [...legacyRows.map(legacyToMutasi), ...inventoryRows.map(movementToMutasi)].sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || Math.abs(b.id) - Math.abs(a.id),
    );
    const start = (page - 1) * limit;
    const data = merged.slice(start, start + limit);

    res.status(200).json({
      item,
      saldo,
      riwayat: {
        data,
        meta: {
          page,
          limit,
          total: merged.length,
          totalPages: Math.max(1, Math.ceil(merged.length / limit)),
          truncated: legacyRows.length >= CAP || inventoryRows.length >= CAP,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil stok item" });
  }
}
