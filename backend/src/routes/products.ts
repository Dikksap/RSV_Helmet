import { Router } from "express";
import {
  getProductsHandler,
  getProductDetail,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
  getProductVariantsHandler,
  addVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
} from "../controller/product/product.js";

const router = Router();

// =============================================
// GET /api/products - Ambil semua produk
// =============================================
router.get("/", getProductsHandler);

// =============================================
// GET /api/products/:id - Ambil produk by ID
// =============================================
router.get("/:id", getProductDetail);

// =============================================
// POST /api/products - Buat produk baru
// =============================================
router.post("/", createProductHandler);

// =============================================
// PUT /api/products/:id - Update nama produk
// =============================================
router.put("/:id", updateProductHandler);

// =============================================
// DELETE /api/products/:id - Hapus produk
// (variants ikut terhapus karena onDelete: Cascade)
// =============================================
router.delete("/:id", deleteProductHandler);

// =============================================
// GET /api/products/:id/variants - Ambil semua variant produk
// =============================================
router.get("/:id/variants", getProductVariantsHandler);

// =============================================
// POST /api/products/:id/variants - Tambah variant ke produk
// =============================================
router.post("/:id/variants", addVariantHandler);

// =============================================
// PATCH /api/products/:id/variants/:variantId - Update tanggal variant
// =============================================
router.patch("/:id/variants/:variantId", updateVariantHandler);

// =============================================
// DELETE /api/products/:id/variants/:variantId - Hapus variant
// =============================================
router.delete("/:id/variants/:variantId", deleteVariantHandler);

export default router;
