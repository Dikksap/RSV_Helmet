import type { Request, Response } from "express";
import { createSubassembly, deleteSubassembly, ensureSubassembliesFromSMItems, getSubassemblyById, listSubassemblies, updateSubassembly } from "../../model/subassembly/subassembly.js";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePositiveId(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return {};
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return { error: `Field '${field}' harus angka bulat positif` };
  return { value: id };
}

function parseCreateBody(body: unknown):
  | { kode: string; nama: string; itemId?: number | null; productVariantId?: number | null; isActive?: boolean }
  | { error: string } {
  const { kode, nama, itemId, productVariantId, isActive } = (body ?? {}) as Record<string, unknown>;
  if (!kode || typeof kode !== "string" || !kode.trim()) return { error: "Field 'kode' wajib diisi" };
  if (kode.trim().length > 30) return { error: "Field 'kode' maksimal 30 karakter" };
  if (!nama || typeof nama !== "string" || !nama.trim()) return { error: "Field 'nama' wajib diisi" };
  let itemIdValue: number | null | undefined;
  if (itemId !== undefined && itemId !== null && itemId !== "") {
    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) return { error: "Field 'itemId' harus angka bulat positif" };
    itemIdValue = id;
  } else if (itemId === null || itemId === "") {
    itemIdValue = null;
  }
  let productVariantIdValue: number | null | undefined;
  if (productVariantId !== undefined && productVariantId !== null && productVariantId !== "") {
    const id = Number(productVariantId);
    if (!Number.isInteger(id) || id <= 0) return { error: "Field 'productVariantId' harus angka bulat positif" };
    productVariantIdValue = id;
  } else if (productVariantId === null || productVariantId === "") {
    productVariantIdValue = null;
  }
  if (isActive !== undefined && typeof isActive !== "boolean") return { error: "Field 'isActive' harus boolean" };
  return {
    kode: String(kode).trim().toUpperCase(),
    nama: nama.trim(),
    ...(itemIdValue !== undefined ? { itemId: itemIdValue } : {}),
    ...(productVariantIdValue !== undefined ? { productVariantId: productVariantIdValue } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };
}
export async function listSubassembliesHandler(req: Request, res: Response) {
  try {
    const { q, aktif, productVariantId } = req.query;
    let active: boolean | undefined;
    if (aktif !== undefined && aktif !== "") {
      if (aktif === "true" || aktif === "1") active = true;
      else if (aktif === "false" || aktif === "0") active = false;
      else return res.status(400).json({ message: "Query 'aktif' harus 'true' atau 'false'" });
    }
    let variantId: number | undefined;
    if (productVariantId !== undefined && productVariantId !== "") {
      variantId = Number(productVariantId);
      if (!Number.isInteger(variantId) || variantId <= 0) return res.status(400).json({ message: "Query 'productVariantId' harus angka bulat positif" });
    }
    const rows = await listSubassemblies({
      q: typeof q === "string" && q.trim() ? q.trim() : undefined,
      aktif: active,
      productVariantId: variantId,
    });
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data subassembly", error });
  }
}

export async function getSubassemblyDetail(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getSubassemblyById(id);
    if (!row) return res.status(404).json({ message: "Subassembly tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil detail subassembly", error });
  }
}

export async function createSubassemblyHandler(req: Request, res: Response) {
  try {
    const parsed = parseCreateBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await createSubassembly(parsed);
    res.status(201).json(row);
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode subassembly sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Product variant tidak ditemukan" });
    res.status(500).json({ message: "Gagal membuat subassembly", error });
  }
}

export async function updateSubassemblyHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { kode, nama, itemId, productVariantId, isActive } = (req.body ?? {}) as Record<string, unknown>;
    if (kode === undefined && nama === undefined && itemId === undefined && productVariantId === undefined && isActive === undefined) {
      return res.status(400).json({ message: "Minimal satu field: kode, nama, itemId, productVariantId, isActive" });
    }
    const data: { kode?: string; nama?: string; itemId?: number | null; productVariantId?: number | null; isActive?: boolean } = {};
    if (kode !== undefined) {
      if (typeof kode !== "string" || !kode.trim()) return res.status(400).json({ message: "Field 'kode' tidak boleh kosong" });
      if (kode.trim().length > 30) return res.status(400).json({ message: "Field 'kode' maksimal 30 karakter" });
      data.kode = kode.trim().toUpperCase();
    }
    if (nama !== undefined) {
      if (typeof nama !== "string" || !nama.trim()) return res.status(400).json({ message: "Field 'nama' tidak boleh kosong" });
      data.nama = nama.trim();
    }
    if (itemId !== undefined) {
      if (itemId === null || itemId === "") data.itemId = null;
      else {
        const parsed = parsePositiveId(itemId, "itemId");
        if ("error" in parsed) return res.status(400).json({ message: parsed.error });
        data.itemId = parsed.value ?? null;
      }
    }
    if (productVariantId !== undefined) {
      if (productVariantId === null) data.productVariantId = null;
      else {
        const parsed = parsePositiveId(productVariantId, "productVariantId");
        if ("error" in parsed) return res.status(400).json({ message: parsed.error });
        data.productVariantId = parsed.value ?? null;
      }
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "Field 'isActive' harus boolean" });
      data.isActive = isActive;
    }
    const row = await updateSubassembly(id, data);
    res.status(200).json(row);
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Subassembly tidak ditemukan" });
    if (error?.code === "P2002") return res.status(409).json({ message: "Kode subassembly sudah dipakai" });
    if (error?.code === "P2003") return res.status(400).json({ message: "Product variant tidak ditemukan" });
    res.status(500).json({ message: "Gagal mengupdate subassembly", error });
  }
}

export async function deleteSubassemblyHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    await deleteSubassembly(id);
    res.status(200).json({ message: "Subassembly berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Subassembly tidak ditemukan" });
    if (error?.code === "P2003") return res.status(409).json({ message: "Subassembly masih dipakai BOM atau product variant" });
    res.status(500).json({ message: "Gagal menghapus subassembly", error });
  }
}

export async function syncSubassembliesHandler(req: Request, res: Response) {
  try {
    const count = await ensureSubassembliesFromSMItems();
    res.status(200).json({ message: "Sinkronisasi subassembly dari item selesai", count });
  } catch (error) {
    res.status(500).json({ message: "Gagal sinkronisasi subassembly", error });
  }
}
