import { Router } from "express";
import {
  createHasilProduksiHandler,
  getHasilProduksiHandler,
  getRekapHasilProduksiHandler,
  getWipLedgerHarianHandler,
  getWipPerItemHandler,
  listHasilProduksiHandler,
} from "../controller/hasilProduksiHarian/hasilProduksiHarian.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize, requirePermission("KELOLA_ITEM"), createHasilProduksiHandler);

router.get("/", authorize, listHasilProduksiHandler);
// Daftarkan sebelum "/:id" supaya "rekap"/"wip" tidak tertangkap sebagai id.
router.get("/rekap", authorize, getRekapHasilProduksiHandler);
router.get("/wip", authorize, getWipPerItemHandler);
router.get("/wip/harian", authorize, getWipLedgerHarianHandler);
router.get("/:id", authorize, getHasilProduksiHandler);

export default router;
