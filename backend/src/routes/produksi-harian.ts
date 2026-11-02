import { Router } from "express";
import {
  bomPreviewHandler,
  createPenerimaanHandler,
  createProduksiHandler,
  getOptionsHandler,
  getProduksiHandler,
  listLokasiHandler,
  listProduksiHandler,
  listStokGudangHandler,
} from "../controller/produksiHarian/produksiHarian.js";
import { authenticate, authorize, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize, requireRole("produksi", "admin"));

router.get("/opsi", getOptionsHandler);
router.get("/lokasi", listLokasiHandler);
router.get("/stok-gudang", listStokGudangHandler);
router.get("/bom-preview", bomPreviewHandler);
router.get("/", listProduksiHandler);
router.get("/:id", getProduksiHandler);
router.post("/", createProduksiHandler);
router.post("/penerimaan", createPenerimaanHandler);

export default router;
