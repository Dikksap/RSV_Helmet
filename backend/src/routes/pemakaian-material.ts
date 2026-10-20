import { Router } from "express";
import {
  listPemakaianHandler,
  getPemakaianHandler,
  getStokDivisiHandler,
  createPemakaianHandler,
  updatePemakaianHandler,
  deletePemakaianHandler,
} from "../controller/pemakaianMaterial/pemakaianMaterial.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", listPemakaianHandler);
router.get("/stok-divisi", getStokDivisiHandler);
router.get("/:id", getPemakaianHandler);
router.post("/", adminOnly, createPemakaianHandler);
router.put("/:id", adminOnly, updatePemakaianHandler);
router.delete("/:id", adminOnly, deletePemakaianHandler);

export default router;
