import { Router } from "express";
import {
  getKaryawanHandler,
  getKaryawanDetail,
  createKaryawanHandler,
  updateKaryawanHandler,
  deleteKaryawanHandler,
} from "../controller/karyawan/karyawan.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getKaryawanHandler);
router.get("/:id", getKaryawanDetail);
router.post("/", adminOnly, createKaryawanHandler);
router.put("/:id", adminOnly, updateKaryawanHandler);
router.delete("/:id", adminOnly, deleteKaryawanHandler);

export default router;
