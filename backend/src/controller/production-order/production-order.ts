import type { Request, Response } from "express";
import {
  getAllOrders,
  getOrderById,
  getOrderSummary,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  getCapacities,
  replaceCapacities,
  getRealisasi,
  getFinishgoodCounts,
  saveRealisasi,
  getRealisasiStages,
  saveRealisasiStages,
  REALISASI_STAGES,
} from "../../model/production-order/production-order.js";
import { buildSchedule, defaultAnchors, endOfPeriode } from "../../model/production-order/schedule.js";

const VALID_STATUS = ["DRAFT", "AKTIF", "SELESAI", "BATAL"] as const;

function validId(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validItem(it: any): string | null {
  if (!it || !Number.isInteger(it.variantId) || it.variantId <= 0)
    return "Field 'variantId' wajib diisi dan berupa angka bulat positif";
  if (!Number.isInteger(it.qty) || it.qty < 0) return "Field 'qty' harus bilangan bulat >= 0";
  if (it.priority !== undefined && (!Number.isInteger(it.priority) || it.priority < 0))
    return "Field 'priority' harus bilangan bulat >= 0";
  return null;
}

export async function getOrdersHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(await getAllOrders());
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil production order", error });
  }
}

export async function getOrderDetail(req: Request, res: Response) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const order = await (req.query.summary === "1" ? getOrderSummary(id) : getOrderById(id));
    if (!order) return res.status(404).json({ message: "Production order tidak ditemukan" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil production order", error });
  }
}

function validMulai(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || Number.isNaN(new Date(v).getTime()))
    return "Field 'mulaiProduksi' harus tanggal valid atau null";
  return null;
}

export async function createOrderHandler(req: Request, res: Response) {
  try {
    const { nomor, periode, label, status, items, mulaiProduksi } = req.body;
    if (!nomor || typeof nomor !== "string" || !nomor.trim())
      return res.status(400).json({ message: "Field 'nomor' wajib diisi" });
    if (!periode || typeof periode !== "string" || !periode.trim())
      return res.status(400).json({ message: "Field 'periode' wajib diisi" });
    if (status !== undefined && !VALID_STATUS.includes(status))
      return res.status(400).json({ message: "Status harus DRAFT/AKTIF/SELESAI/BATAL" });
    if (items !== undefined) {
      if (!Array.isArray(items)) return res.status(400).json({ message: "Field 'items' harus array" });
      for (const it of items) {
        const err = validItem(it);
        if (err) return res.status(400).json({ message: err });
      }
    }
    const errMulai = validMulai(mulaiProduksi);
    if (errMulai) return res.status(400).json({ message: errMulai });
    const order = await createOrder({ nomor, periode, label, status, items, mulaiProduksi });
    res.status(201).json(order);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Nomor production order sudah ada" });
    res.status(500).json({ message: "Gagal membuat production order", error });
  }
}

export async function updateOrderHandler(req: Request, res: Response) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { nomor, periode, label, status, mulaiProduksi } = req.body;
    if (status !== undefined && !VALID_STATUS.includes(status))
      return res.status(400).json({ message: "Status harus DRAFT/AKTIF/SELESAI/BATAL" });
    if (nomor !== undefined && (typeof nomor !== "string" || !nomor.trim()))
      return res.status(400).json({ message: "Field 'nomor' tidak valid" });
    if (periode !== undefined && (typeof periode !== "string" || !periode.trim()))
      return res.status(400).json({ message: "Field 'periode' tidak valid" });
    const errMulai = validMulai(mulaiProduksi);
    if (errMulai) return res.status(400).json({ message: errMulai });
    const order = await updateOrder(id, { nomor, periode, label, status, mulaiProduksi });
    res.status(200).json(order);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Nomor production order sudah ada" });
    if (error?.code === "P2025") return res.status(404).json({ message: "Production order tidak ditemukan" });
    res.status(500).json({ message: "Gagal mengupdate production order", error });
  }
}

export async function deleteOrderHandler(req: Request, res: Response) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteOrder(id);
    res.status(200).json({ message: "Production order berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Production order tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus production order", error });
  }
}

export async function addOrderItemHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const err = validItem(req.body);
    if (err) return res.status(400).json({ message: err });
    const item = await addOrderItem(orderId, req.body);
    res.status(201).json(item);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Variant sudah ada di order ini" });
    if (error?.code === "P2003" || error?.code === "P2025")
      return res.status(404).json({ message: "Production order atau variant tidak ditemukan" });
    res.status(500).json({ message: "Gagal menambah item", error });
  }
}

function validCapacity(it: any): string | null {
  if (!it || typeof it.stage !== "string" || !it.stage.trim())
    return "Field 'stage' wajib diisi";
  for (const f of ["kapasitasWeekday", "kapasitasSabtu", "hariKerja", "totalKapasitas", "urutan"] as const) {
    if (it[f] !== undefined && (!Number.isInteger(it[f]) || it[f] < 0))
      return `Field '${f}' harus bilangan bulat >= 0`;
  }
  for (const f of ["mulai", "selesai"] as const) {
    if (it[f] !== undefined && it[f] !== null && Number.isNaN(new Date(it[f]).getTime()))
      return `Field '${f}' harus tanggal valid`;
  }
  if (it.catatan !== undefined && it.catatan !== null && typeof it.catatan !== "string")
    return "Field 'catatan' harus string";
  return null;
}

export async function getCapacitiesHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    res.status(200).json(await getCapacities(orderId));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil kapasitas produksi", error });
  }
}

export async function replaceCapacitiesHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    if (!Array.isArray(req.body)) return res.status(400).json({ message: "Body harus array" });
    for (const it of req.body) {
      const err = validCapacity(it);
      if (err) return res.status(400).json({ message: err });
    }
    res.status(200).json(await replaceCapacities(orderId, req.body));
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Production order tidak ditemukan" });
    res.status(500).json({ message: "Gagal menyimpan kapasitas produksi", error });
  }
}

export async function getScheduleHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Production order tidak ditemukan" });
    const defaults = defaultAnchors(order.periode);
    const prepDays = typeof req.query.prep === "string" && req.query.prep ? req.query.prep.split(",") : defaults.prepDays;
    const qcDays = typeof req.query.qc === "string" && req.query.qc ? req.query.qc.split(",") : defaults.qcDays;
    const capacities = await getCapacities(orderId);
    const akhirBulan = endOfPeriode(order.periode);
    const { rows, meta, rincian } = buildSchedule(
      order.items.map((it) => ({
        variantId: it.variantId,
        qty: it.qty,
        priority: it.priority,
        style: it.variant.style.nama,
        color: it.variant.color.nama,
        size: it.variant.size.nama,
        sizeUrutan: it.variant.size.urutan,
      })),
      capacities.map((c) => ({
        stage: c.stage,
        kapasitasWeekday: c.kapasitasWeekday,
        kapasitasSabtu: c.kapasitasSabtu,
        mulai: c.mulai ? new Date(c.mulai) : null,
        selesai: c.selesai ? new Date(c.selesai) : null,
      })),
      prepDays,
      qcDays,
      akhirBulan,
      order.mulaiProduksi ? new Date(order.mulaiProduksi) : null,
    );
    res.status(200).json({
      order: { id: order.id, nomor: order.nomor, periode: order.periode, totalQty: order.totalQty },
      rows,
      rincian,
      meta: { ...meta, prepDays, qcDays, akhirBulan },
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal menyusun jadwal produksi", error });
  }
}

export async function updateOrderItemHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    const itemId = validId(req.params.itemId);
    if (!orderId || !itemId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { qty, priority } = req.body;
    if (qty === undefined && priority === undefined)
      return res.status(400).json({ message: "Field 'qty' atau 'priority' wajib diisi" });
    if (qty !== undefined && (!Number.isInteger(qty) || qty < 0))
      return res.status(400).json({ message: "Field 'qty' harus bilangan bulat >= 0" });
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0))
      return res.status(400).json({ message: "Field 'priority' harus bilangan bulat >= 0" });
    const item = await updateOrderItem(orderId, itemId, { qty, priority });
    res.status(200).json(item);
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Item tidak ditemukan" });
    res.status(500).json({ message: "Gagal mengupdate item", error });
  }
}

export async function deleteOrderItemHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    const itemId = validId(req.params.itemId);
    if (!orderId || !itemId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteOrderItem(orderId, itemId);
    res.status(200).json({ message: "Item berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Item tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus item", error });
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(v: unknown): Date | null {
  if (typeof v !== "string" || !DAY_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayDay(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export async function getRealisasiHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const awal = req.query.awal === undefined ? null : validDay(req.query.awal);
    const akhir = req.query.akhir === undefined ? null : validDay(req.query.akhir);
    if ((req.query.awal !== undefined && !awal) || (req.query.akhir !== undefined && !akhir))
      return res.status(400).json({ message: "Query 'awal'/'akhir' harus tanggal valid (YYYY-MM-DD)" });
    if (awal && akhir && awal.getTime() > akhir.getTime())
      return res.status(400).json({ message: "Query 'awal' tidak boleh lebih besar dari 'akhir'" });
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Production order tidak ditemukan" });
    const [realisasi, finishgood, tahapan] = await Promise.all([
      getRealisasi(orderId, awal, akhir),
      getFinishgoodCounts(orderId, awal, akhir),
      getRealisasiStages(orderId, awal, akhir),
    ]);
    res.status(200).json({ orderId, realisasi, finishgood, tahapan });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil realisasi produksi", error });
  }
}

export async function saveRealisasiHandler(req: Request, res: Response) {
  try {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const tanggal = validDay(req.body?.tanggal);
    if (!tanggal) return res.status(400).json({ message: "Field 'tanggal' wajib tanggal valid (YYYY-MM-DD)" });
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    if (req.body.tanggal < today)
      return res.status(400).json({ message: "Tanggal sebelum hari ini terkunci dan tidak bisa diubah" });
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Field 'items' wajib array tidak kosong" });
    for (const it of items) {
      if (!it || !Number.isInteger(it.variantId) || it.variantId <= 0)
        return res.status(400).json({ message: "Field 'variantId' tiap item wajib angka bulat positif" });
      if (!Number.isInteger(it.qty) || it.qty < 0)
        return res.status(400).json({ message: "Field 'qty' tiap item harus bilangan bulat >= 0" });
      if (it.reject !== undefined && (!Number.isInteger(it.reject) || it.reject < 0))
        return res.status(400).json({ message: "Field 'reject' tiap item harus bilangan bulat >= 0" });
    }
    const tahapan = req.body?.tahapan;
    if (tahapan !== undefined) {
      if (!Array.isArray(tahapan)) return res.status(400).json({ message: "Field 'tahapan' harus array" });
      for (const t of tahapan) {
        if (!t || !(REALISASI_STAGES as readonly string[]).includes(t.stage))
          return res.status(400).json({ message: `Field 'stage' harus salah satu: ${REALISASI_STAGES.join(", ")}` });
        if (!Number.isInteger(t.qty) || t.qty < 0)
          return res.status(400).json({ message: "Field 'qty' tiap tahapan harus bilangan bulat >= 0" });
      }
    }
    const saved = await saveRealisasi(orderId, tanggal, items);
    const savedStages = tahapan ? await saveRealisasiStages(orderId, tanggal, tahapan) : [];
    res.status(200).json({ items: saved, tahapan: savedStages });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Production order tidak ditemukan" });
    if (error?.code === "P2003") return res.status(404).json({ message: "Variant tidak ditemukan" });
    res.status(500).json({ message: "Gagal menyimpan realisasi produksi", error });
  }
}
