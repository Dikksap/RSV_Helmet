import type { Request, Response } from "express";
import { getItemById } from "../../model/item/item.js";
import { catatMutasi, getSaldo, getSaldoBulk, getRingkasanBulk, listMutasiItem, lockItem, StokKurangError } from "../../model/stokItem/stokItem.js";
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
