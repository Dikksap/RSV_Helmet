import { Router } from "express";
import {
  getVariantProdukHandler,
  getVariantProdukDetail,
  createVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
} from "../controller/variantproduk/variantproduk.js";

const router = Router();

// =============================================
// GET /api/variant-produk - Ambil data variant
// dari database view (filter opsional via query params)
// =============================================
router.get("/", getVariantProdukHandler);

// =============================================
// GET /api/variant-produk/:id - Detail variant
// =============================================
router.get("/:id", getVariantProdukDetail);

// =============================================
// POST /api/variant-produk - Buat variant baru
// Body: { productId, styleId, colorId, sizeId, tanggal? }
// =============================================
router.post("/", createVariantHandler);

// =============================================
// PUT /api/variant-produk/:id - Update variant (parsial)
// Body opsional: { styleId, colorId, sizeId, tanggal }
// =============================================
router.put("/:id", updateVariantHandler);

// =============================================
// DELETE /api/variant-produk/:id - Hapus variant
// =============================================
router.delete("/:id", deleteVariantHandler);

export default router;
