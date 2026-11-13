import { Router } from "express";
import {
  createHasilProduksiHandler,
  getHasilProduksiHandler,
  listHasilProduksiHandler,
} from "../controller/hasilProduksiHarian/hasilProduksiHarian.js";
import { authenticate, authorize, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize, requireRole("produksi", "admin", "gudang"));

router.get("/", listHasilProduksiHandler);
router.get("/:id", getHasilProduksiHandler);
router.post("/", createHasilProduksiHandler);

export default router;
