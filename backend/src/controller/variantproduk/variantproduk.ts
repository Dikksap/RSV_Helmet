import type { Request, Response } from "express";
import {
  getVariantProduk,
  getVariantProdukById,
  createVariant,
  updateVariant,
  deleteVariant,
  type VariantFilters,
} from "../../model/variantproduk/variantproduk.js";
import { broadcast } from "../../websocket/socket.js";

// =============================================
// Helpers
// =============================================

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (value === undefined || value === "" || !Number.isInteger(num) || num < 1) {
    return null;
  }
  return num;
}

function parseTanggal(value: unknown): Date | null {
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? null : date;
}

// =============================================
// GET /api/variant-produk - Ambil data variant
// dari database view (filter opsional via query params)
// =============================================

export async function getVariantProdukHandler(req: Request, res: Response) {
  try {
    const filters: VariantFilters = {};

    for (const key of ["productId", "styleId", "colorId", "sizeId"] as const) {
      const raw = req.query[key];
      if (raw === undefined || raw === "") continue;

      const num = Number(raw);
      if (!Number.isInteger(num) || num < 1) {
        return res.status(400).json({ message: `Query param '${key}' harus berupa angka bulat positif` });
      }
      filters[key] = num;
    }

    const rows = await getVariantProduk(filters);

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data varian produk", error });
  }
}

// =============================================
// GET /api/variant-produk/:id - Detail variant
// =============================================

export async function getVariantProdukDetail(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const row = await getVariantProdukById(id);

    if (!row) {
      return res.status(404).json({ message: "Variant produk tidak ditemukan" });
    }

    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data varian produk", error });
  }
}

// =============================================
// POST /api/variant-produk - Buat variant baru
// Body: { productId, styleId, colorId, sizeId, tanggal? }
// =============================================

export async function createVariantHandler(req: Request, res: Response) {
  try {
    const { productId, styleId, colorId, sizeId, tanggal } = req.body;

    const parsed = {
      productId: parsePositiveInt(productId),
      styleId: parsePositiveInt(styleId),
      colorId: parsePositiveInt(colorId),
      sizeId: parsePositiveInt(sizeId),
    };

    for (const [field, value] of Object.entries(parsed)) {
      if (value === null) {
        return res
          .status(400)
          .json({ message: `Field '${field}' wajib diisi dan berupa angka bulat positif` });
      }
    }

    let tanggalDate: Date | undefined;
    if (tanggal !== undefined && tanggal !== null && tanggal !== "") {
      const d = parseTanggal(tanggal);
      if (!d) {
        return res.status(400).json({ message: "Field 'tanggal' harus berupa tanggal yang valid" });
      }
      tanggalDate = d;
    }

    const variant = await createVariant({
      productId: parsed.productId!,
      styleId: parsed.styleId!,
      colorId: parsed.colorId!,
      sizeId: parsed.sizeId!,
      tanggal: tanggalDate,
    });

    void broadcast({
      type: "variant.created",
      message: "Variant berhasil ditambahkan",
      data: variant,
    });

    res.status(201).json(variant);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kombinasi style, color, size sudah ada untuk produk ini" });
    }
    if (error instanceof Error && error.message.includes("tidak ditemukan")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Gagal menambahkan variant", error });
  }
}

// =============================================
// PUT /api/variant-produk/:id - Update variant (parsial)
// Body opsional: { styleId, colorId, sizeId, tanggal }
// Minimal satu field
// =============================================

export async function updateVariantHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const { styleId, colorId, sizeId, tanggal } = req.body;
    const hasFields =
      styleId !== undefined || colorId !== undefined || sizeId !== undefined || tanggal !== undefined;

    if (!hasFields) {
      return res.status(400).json({
        message:
          "Minimal satu field wajib diisi untuk update: 'styleId', 'colorId', 'sizeId', 'tanggal'",
      });
    }

    const data: { styleId?: number; colorId?: number; sizeId?: number; tanggal?: Date } = {};

    if (styleId !== undefined) {
      const v = parsePositiveInt(styleId);
      if (v === null) return res.status(400).json({ message: "Field 'styleId' harus angka bulat positif" });
      data.styleId = v;
    }
    if (colorId !== undefined) {
      const v = parsePositiveInt(colorId);
      if (v === null) return res.status(400).json({ message: "Field 'colorId' harus angka bulat positif" });
      data.colorId = v;
    }
    if (sizeId !== undefined) {
      const v = parsePositiveInt(sizeId);
      if (v === null) return res.status(400).json({ message: "Field 'sizeId' harus angka bulat positif" });
      data.sizeId = v;
    }
    if (tanggal !== undefined) {
      const d = parseTanggal(tanggal);
      if (!d) return res.status(400).json({ message: "Field 'tanggal' harus berupa tanggal yang valid" });
      data.tanggal = d;
    }

    const variant = await updateVariant(id, data);

    if (!variant) {
      return res.status(404).json({ message: "Variant produk tidak ditemukan" });
    }

    void broadcast({
      type: "variant.updated",
      message: "Variant berhasil diperbarui",
      data: variant,
    });

    res.status(200).json(variant);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kombinasi style, color, size sudah ada untuk produk ini" });
    }
    if (error?.code === "P2003") {
      return res.status(400).json({ message: "styleId, colorId, atau sizeId merujuk data yang tidak ada" });
    }
    res.status(500).json({ message: "Gagal mengupdate variant", error });
  }
}

// =============================================
// DELETE /api/variant-produk/:id - Hapus variant
// =============================================

export async function deleteVariantHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const deleted = await deleteVariant(id);

    if (!deleted) {
      return res.status(404).json({ message: "Variant produk tidak ditemukan" });
    }

    void broadcast({
      type: "variant.deleted",
      message: "Variant berhasil dihapus",
      data: { id },
    });

    res.status(200).json({ message: "Variant berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2003") {
      return res.status(409).json({
        message:
          "Variant tidak dapat dihapus karena masih direferensikan oleh data lain (riwayat barang / counter)",
      });
    }
    res.status(500).json({ message: "Gagal menghapus variant", error });
  }
}
