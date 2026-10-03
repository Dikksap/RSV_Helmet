import { Router } from "express";
import {
  getKaryawanHandler,
  getKaryawanDetail,
  createKaryawanHandler,
  updateKaryawanHandler,
  deleteKaryawanHandler,
} from "../controller/karyawan/karyawan.js";

const router = Router();

router.get("/", getKaryawanHandler);
router.get("/:id", getKaryawanDetail);
router.post("/", createKaryawanHandler);
router.put("/:id", updateKaryawanHandler);
router.delete("/:id", deleteKaryawanHandler);

export default router;
