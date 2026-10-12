import { Router } from "express";
import {
  getVariantProdukHandler,
  getVariantProdukDetail,
  createVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
} from "../controller/variantproduk/variantproduk.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

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
router.post("/", adminOnly, createVariantHandler);

// =============================================
// PUT /api/variant-produk/:id - Update variant (parsial)
// Body opsional: { styleId, colorId, sizeId, tanggal }
// =============================================
router.put("/:id", adminOnly, updateVariantHandler);

// =============================================
// DELETE /api/variant-produk/:id - Hapus variant
// =============================================
router.delete("/:id", adminOnly, deleteVariantHandler);

export default router;
