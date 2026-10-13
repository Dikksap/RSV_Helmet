import { Router } from "express";
import {
  getDivisiHandler,
  getDivisiDetail,
  createDivisiHandler,
  updateDivisiHandler,
  deleteDivisiHandler,
} from "../controller/divisi/divisi.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

// List + detail publik: dipakai dropdown form permintaan tanpa login
// (hanya nama master, pola sama seperti GET /api/status-barang).
router.get("/", getDivisiHandler);
router.get("/:id", getDivisiDetail);

router.use(authenticate);

router.post("/", adminOnly, createDivisiHandler);
router.put("/:id", adminOnly, updateDivisiHandler);
router.delete("/:id", adminOnly, deleteDivisiHandler);

export default router;
