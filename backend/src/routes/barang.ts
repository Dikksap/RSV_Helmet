import { Router } from "express";
import {
  getGenerateInfoHandler,
  generateBarang,
} from "../controller/barang/generate.controller.js";
import {
  scanBarangHandler,
  bulkScanBarangHandler,
} from "../controller/barang/scan.controller.js";
import {
  updateStatusBarangHandler,
  bulkStatusBarangHandler,
} from "../controller/barang/status.controller.js";
import {
  listBarangHandler,
  getBarangHariIniHandler,
  getBarangDetail,
  getRiwayatHandler,
  getStatusSummaryHandler,
  getStatsHandler,
  getBatchRentangTanggalHandler,
  getFinishgoodPerBulanHandler,
  searchBarangHandler,
} from "../controller/barang/query.controller.js";
import { exportBarangHandler } from "../controller/barang/export.controller.js";
import {
  createBarangHandler,
  updateBarangHandler,
  deleteBarangHandler,
} from "../controller/barang/crud.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

const operatorOnly = requireRole("admin", "user");

router.use(authenticate);

// =============================================
// GET /api/barang/generate-info?variantId=1
// HARUS didaftarkan sebelum /:id agar tidak
// tertangkap sebagai id
// =============================================
router.get("/generate-info", operatorOnly, getGenerateInfoHandler);

// POST /api/barang/generate
router.post("/generate", operatorOnly, generateBarang);

// POST /api/barang - Create single barang (CRUD)
router.post("/", operatorOnly, createBarangHandler);

// GET /api/barang - List semua barang
router.get("/", listBarangHandler);

// GET /api/barang/status-summary
router.get("/status-summary", getStatusSummaryHandler);

// GET /api/barang/stats
router.get("/stats", getStatsHandler);

// GET /api/barang/batch-rentang-tanggal
router.get("/batch-rentang-tanggal", getBatchRentangTanggalHandler);

// GET /api/barang/finishgood-per-bulan
router.get("/finishgood-per-bulan", getFinishgoodPerBulanHandler);

// GET /api/barang/search?q=
router.get("/search", searchBarangHandler);

// GET /api/barang/export?format=csv|json
router.get("/export", exportBarangHandler);

// GET /api/barang/hari-ini - Barang dengan tanggal hari ini
router.get("/hari-ini", getBarangHariIniHandler);

// GET /api/barang/scan/:kodeBarang
router.get("/scan/:kodeBarang", operatorOnly, scanBarangHandler);

// POST /api/barang/scan/bulk
router.post("/scan/bulk", operatorOnly, bulkScanBarangHandler);

// POST /api/barang/bulk-status
router.post("/bulk-status", operatorOnly, bulkStatusBarangHandler);

// PUT /api/barang/:id - Update barang (CRUD)
router.put("/:id", operatorOnly, updateBarangHandler);

// DELETE /api/barang/:id - Hapus barang (CRUD)
router.delete("/:id", operatorOnly, deleteBarangHandler);

// PATCH /api/barang/:id/status
router.patch("/:id/status", operatorOnly, updateStatusBarangHandler);

// GET /api/barang/summary - alias untuk status-summary
router.get("/summary", getStatusSummaryHandler);

// GET /api/barang/:id/riwayat
router.get("/:id/riwayat", getRiwayatHandler);

// GET /api/barang/:id - Detail barang by ID
router.get("/:id", getBarangDetail);

export default router;
