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
  getRekapVariantHandler,
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
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

const lihat = requirePermission("BARANG_LIHAT");
const statistik = requirePermission("BARANG_STATISTIK_LIHAT");
const scan = requirePermission("BARANG_SCAN");
const ubahStatus = requirePermission("BARANG_UBAH_STATUS");
const generate = requirePermission("BARANG_GENERATE");
const kelola = requirePermission("BARANG_KELOLA");

router.use(authenticate, authorize);

// =============================================
// GET /api/barang/generate-info?variantId=1
// HARUS didaftarkan sebelum /:id agar tidak
// tertangkap sebagai id
// =============================================
router.get("/generate-info", generate, getGenerateInfoHandler);

// POST /api/barang/generate
router.post("/generate", generate, generateBarang);

// POST /api/barang - Create single barang (CRUD)
router.post("/", kelola, createBarangHandler);

// GET /api/barang - List semua barang
router.get("/", lihat, listBarangHandler);

// GET /api/barang/status-summary
router.get("/status-summary", statistik, getStatusSummaryHandler);

// GET /api/barang/stats
router.get("/stats", statistik, getStatsHandler);

// GET /api/barang/batch-rentang-tanggal
router.get("/batch-rentang-tanggal", statistik, getBatchRentangTanggalHandler);

// GET /api/barang/finishgood-per-bulan
router.get("/finishgood-per-bulan", statistik, getFinishgoodPerBulanHandler);

// GET /api/barang/search?q=
router.get("/search", lihat, searchBarangHandler);

// GET /api/barang/export?format=csv|json
router.get("/export", lihat, exportBarangHandler);

// GET /api/barang/hari-ini - Barang dengan tanggal hari ini
router.get("/hari-ini", lihat, getBarangHariIniHandler);

// GET /api/barang/rekap-variant - Agregat barang per variant
router.get("/rekap-variant", lihat, getRekapVariantHandler);

// GET /api/barang/scan/:kodeBarang
router.get("/scan/:kodeBarang", scan, scanBarangHandler);

// POST /api/barang/scan/bulk
router.post("/scan/bulk", scan, ubahStatus, bulkScanBarangHandler);

// POST /api/barang/bulk-status
router.post("/bulk-status", ubahStatus, bulkStatusBarangHandler);

// PUT /api/barang/:id - Update barang (CRUD)
router.put("/:id", kelola, updateBarangHandler);

// DELETE /api/barang/:id - Hapus barang (CRUD)
router.delete("/:id", kelola, deleteBarangHandler);

// PATCH /api/barang/:id/status
router.patch("/:id/status", ubahStatus, updateStatusBarangHandler);

// GET /api/barang/summary - alias untuk status-summary
router.get("/summary", statistik, getStatusSummaryHandler);

// GET /api/barang/:id/riwayat
router.get("/:id/riwayat", lihat, getRiwayatHandler);

// GET /api/barang/:id - Detail barang by ID
router.get("/:id", lihat, getBarangDetail);

export default router;
