import type { Request, Response } from "express";
import {
  BomSiklikusError,
  BomTidakDitemukanError,
  createBom,
  deleteBom,
  getBomById,
  listBoms,
  updateBom,
} from "../../model/bom/bom.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePositiveId(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return { value: null };
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return { error: `Field '${field}' harus angka bulat positif` };
  return { value: id };
}

function parseDecimal(value: unknown, field: string, positive: boolean, min?: number, max?: number) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return { error: `Field '${field}' harus angka valid` };
  if (positive && n <= 0) return { error: `Field '${field}' harus lebih dari 0` };
  if (!positive && n < 0) return { error: `Field '${field}' tidak boleh negatif` };
  if (min !== undefined && n < min) return { error: `Field '${field}' minimal ${min}` };
  if (max !== undefined && n > max) return { error: `Field '${field}' maksimal ${max}` };
  return { value: n };
}

function parseDate(value: unknown, field: string) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: `Field '${field}' harus string tanggal` };
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return { error: `Field '${field}' harus tanggal valid` };
  return { value: d };
}

function parseItem(raw: unknown): { item: Record<string, unknown> } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Item BOM harus objek" };
  const { urutan, itemId, subassemblyId, quantity, unit, scrapPercent } = raw as Record<string, unknown>;
  const q = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return { error: "Field 'quantity' wajib angka lebih dari 0" };

  let urutanValue: number | undefined;
  if (urutan !== undefined && urutan !== null && urutan !== "") {
    const n = Number(urutan);
    if (!Number.isInteger(n) || n <= 0) return { error: "Field 'urutan' harus angka bulat positif" };
    urutanValue = n;
  }

  const hasItem = itemId !== undefined && itemId !== null && itemId !== "";
  const hasSub = subassemblyId !== undefined && subassemblyId !== null && subassemblyId !== "";
  if (hasItem === hasSub) return { error: "Item BOM harus tepat satu: itemId atau subassemblyId" };

  let itemIdValue: number | null = null;
  let subassemblyIdValue: number | null = null;
  if (hasItem) {
    const n = Number(itemId);
    if (!Number.isInteger(n) || n <= 0) return { error: "Field 'itemId' harus angka bulat positif" };
    itemIdValue = n;
  } else {
    const n = Number(subassemblyId);
    if (!Number.isInteger(n) || n <= 0) return { error: "Field 'subassemblyId' harus angka bulat positif" };
    subassemblyIdValue = n;
  }

  if (unit !== undefined && unit !== null && (typeof unit !== "string" || !String(unit).trim())) {
    return { error: "Field 'unit' tidak boleh kosong" };
  }
  let scrapPercentValue: number | undefined;
  if (scrapPercent !== undefined && scrapPercent !== null && scrapPercent !== "") {
    const n = Number(scrapPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Field 'scrapPercent' harus angka 0 sampai 100" };
    scrapPercentValue = n;
  }

  const item: Record<string, unknown> = {
    quantity: q,
  };
  if (urutanValue !== undefined) item.urutan = urutanValue;
  if (itemIdValue !== null) item.itemId = itemIdValue;
  if (subassemblyIdValue !== null) item.subassemblyId = subassemblyIdValue;
  if (unit !== undefined && unit !== null) item.unit = String(unit).trim();
  if (scrapPercentValue !== undefined) item.scrapPercent = scrapPercentValue;
  return { item };
}

export async function listBomsHandler(req: Request, res: Response) {
  try {
    const { q, aktif, outputType, productVariantId, subassemblyId, version } = req.query;
    let active: boolean | undefined;
    if (aktif !== undefined && aktif !== "") {
      if (aktif === "true" || aktif === "1") active = true;
      else if (aktif === "false" || aktif === "0") active = false;
      else return res.status(400).json({ message: "Query 'aktif' harus 'true' atau 'false'" });
    }
    if (outputType !== undefined && outputType !== "" && outputType !== "product" && outputType !== "subassembly") {
      return res.status(400).json({ message: "Query 'outputType' harus 'product' atau 'subassembly'" });
    }
    let pid: number | undefined;
    if (productVariantId !== undefined && productVariantId !== "") {
      pid = Number(productVariantId);
      if (!Number.isInteger(pid) || pid <= 0) return res.status(400).json({ message: "Query 'productVariantId' harus angka bulat positif" });
    }
    let sid: number | undefined;
    if (subassemblyId !== undefined && subassemblyId !== "") {
      sid = Number(subassemblyId);
      if (!Number.isInteger(sid) || sid <= 0) return res.status(400).json({ message: "Query 'subassemblyId' harus angka bulat positif" });
    }
    const rows = await listBoms({
      q: typeof q === "string" && q.trim() ? q.trim() : undefined,
      active,
      outputType: outputType === "product" || outputType === "subassembly" ? outputType : undefined,
      productVariantId: pid,
      subassemblyId: sid,
    });
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data BOM", error });
  }
}

export async function getBomDetail(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getBomById(id);
    if (!row) return res.status(404).json({ message: "BOM tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil detail BOM", error });
  }
}

export async function createBomHandler(req: Request, res: Response) {
  try {
    const { kode, nama, version, isActive, berlakuMulai, berlakuSelesai, productVariantId, subassemblyId, items } = (req.body ?? {}) as Record<string, unknown>;
    if (!nama || typeof nama !== "string" || !nama.trim()) return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    if (!version || typeof version !== "string" || !version.trim()) return res.status(400).json({ message: "Field 'version' wajib diisi" });
    if (kode !== undefined && (typeof kode !== "string" || !kode.trim())) return res.status(400).json({ message: "Field 'kode' tidak boleh kosong" });
    if (isActive !== undefined && typeof isActive !== "boolean") return res.status(400).json({ message: "Field 'isActive' harus boolean" });

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Field 'items' wajib array non-kosong" });
    const parsedItems: Record<string, unknown>[] = [];
    for (const raw of items) {
      const parsed = parseItem(raw);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      parsedItems.push(parsed.item);
    }

    const pv = parsePositiveId(productVariantId, "productVariantId");
    if ("error" in pv) return res.status(400).json({ message: pv.error });
    const sa = parsePositiveId(subassemblyId, "subassemblyId");
    if ("error" in sa) return res.status(400).json({ message: sa.error });
    const hasPv = pv.value != null;
    const hasSa = sa.value != null;
    if (hasPv === hasSa) return res.status(400).json({ message: "Output BOM harus tepat satu: productVariantId atau subassemblyId" });

    const startDate = parseDate(berlakuMulai, "berlakuMulai");
    if ("error" in startDate) return res.status(400).json({ message: startDate.error });
    const endDate = parseDate(berlakuSelesai, "berlakuSelesai");
    if ("error" in endDate) return res.status(400).json({ message: endDate.error });

    const row = await createBom({
      kode: kode === undefined ? null : String(kode).trim(),
      nama: nama.trim(),
      version: version.trim(),
      isActive,
      berlakuMulai: startDate.value,
      berlakuSelesai: endDate.value,
      productVariantId: pv.value,
      subassemblyId: sa.value,
      items: parsedItems.map((item) => ({
        urutan: item.urutan !== undefined ? Number(item.urutan) : null,
        itemId: item.itemId !== undefined ? (item.itemId as number | null) : null,
        subassemblyId: item.subassemblyId !== undefined ? (item.subassemblyId as number | null) : null,
        quantity: item.quantity as number,
        unit: item.unit !== undefined ? (item.unit as string | null) : null,
        scrapPercent: item.scrapPercent !== undefined ? (item.scrapPercent as number | null) : null,
      })),
    });
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Kombinasi output dan version BOM sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Output atau komponen BOM tidak ditemukan" });
    if (error instanceof BomSiklikusError || error?.code === "BOM_SIKLIKUS") return res.status(400).json({ message: "BOM membentuk hubungan komponen yang siklikus" });
    res.status(500).json({ message: "Gagal membuat BOM", error });
  }
}

export async function updateBomHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const existing = await getBomById(id);
    if (!existing) return res.status(404).json({ message: "BOM tidak ditemukan" });

    const { kode, nama, version, isActive, berlakuMulai, berlakuSelesai, productVariantId, subassemblyId, items } = (req.body ?? {}) as Record<string, unknown>;
    if (kode === undefined && nama === undefined && version === undefined && isActive === undefined && berlakuMulai === undefined && berlakuSelesai === undefined && productVariantId === undefined && subassemblyId === undefined && items === undefined) {
      return res.status(400).json({ message: "Minimal satu field atau item BOM harus diubah" });
    }

    const data: Record<string, unknown> = {};
    if (kode !== undefined) {
      if (typeof kode !== "string" || !kode.trim()) return res.status(400).json({ message: "Field 'kode' tidak boleh kosong" });
      if (kode.trim().length > 50) return res.status(400).json({ message: "Field 'kode' maksimal 50 karakter" });
      data.kode = kode.trim();
    }
    if (nama !== undefined) {
      if (typeof nama !== "string" || !nama.trim()) return res.status(400).json({ message: "Field 'nama' tidak boleh kosong" });
      data.nama = nama.trim();
    }
    if (version !== undefined) {
      if (typeof version !== "string" || !version.trim()) return res.status(400).json({ message: "Field 'version' tidak boleh kosong" });
      data.version = version.trim();
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "Field 'isActive' harus boolean" });
      data.isActive = isActive;
    }
    const startDate = parseDate(berlakuMulai, "berlakuMulai");
    if ("error" in startDate) return res.status(400).json({ message: startDate.error });
    if (startDate.value !== undefined) data.berlakuMulai = startDate.value;
    const endDate = parseDate(berlakuSelesai, "berlakuSelesai");
    if ("error" in endDate) return res.status(400).json({ message: endDate.error });
    if (endDate.value !== undefined) data.berlakuSelesai = endDate.value;

    let parsedItems: Record<string, unknown>[] | undefined;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Field 'items' harus array non-kosong" });
      parsedItems = [];
      for (const raw of items) {
        const parsed = parseItem(raw);
        if ("error" in parsed) return res.status(400).json({ message: parsed.error });
        parsedItems.push(parsed.item);
      }
      data.items = parsedItems.map((item) => ({
        urutan: item.urutan !== undefined ? (item.urutan as number | null) : null,
        itemId: item.itemId !== undefined ? (item.itemId as number | null) : null,
        subassemblyId: item.subassemblyId !== undefined ? (item.subassemblyId as number | null) : null,
        quantity: item.quantity as number,
        unit: item.unit !== undefined ? (item.unit as string | null) : null,
        scrapPercent: item.scrapPercent !== undefined ? (item.scrapPercent as number | null) : null,
      }));
    }

    if (productVariantId !== undefined) {
      const pv = parsePositiveId(productVariantId, "productVariantId");
      if ("error" in pv) return res.status(400).json({ message: pv.error });
      data.productVariantId = pv.value;
    }
    if (subassemblyId !== undefined) {
      const sa = parsePositiveId(subassemblyId, "subassemblyId");
      if ("error" in sa) return res.status(400).json({ message: sa.error });
      data.subassemblyId = sa.value;
    }
    const finalPv = data.productVariantId !== undefined ? (data.productVariantId as number | null) : existing.productVariantId;
    const finalSa = data.subassemblyId !== undefined ? (data.subassemblyId as number | null) : existing.subassemblyId;
    if ((finalPv == null) === (finalSa == null)) {
      return res.status(400).json({ message: "Output BOM harus tepat satu: productVariantId atau subassemblyId" });
    }

    const row = await updateBom(id, data as Parameters<typeof updateBom>[1]);
    res.status(200).json(row);
  } catch (error: any) {
    if (error instanceof BomTidakDitemukanError || error?.code === "BOM_TIDAK_DITEMUKAN") return res.status(404).json({ message: "BOM tidak ditemukan" });
    if (error?.code === "P2002") return res.status(409).json({ message: "Kombinasi output dan version BOM sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Output atau komponen BOM tidak ditemukan" });
    if (error?.code === "P2025") return res.status(404).json({ message: "BOM tidak ditemukan" });
    if (error instanceof BomSiklikusError || error?.code === "BOM_SIKLIKUS") return res.status(400).json({ message: "BOM membentuk hubungan komponen yang siklikus" });
    res.status(500).json({ message: "Gagal mengupdate BOM", error });
  }
}

export async function deleteBomHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteBom(id);
    res.status(200).json({ message: "BOM berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "BOM tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus BOM", error });
  }
}
