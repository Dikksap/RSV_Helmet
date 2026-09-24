import { Router } from "express";
import {
  getStatusBarangHandler,
  getStatusBarangDetail,
  createStatusBarangHandler,
  updateStatusBarangHandler,
  deleteStatusBarangHandler,
} from "../controller/statusBarang/statusBarang.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", getStatusBarangHandler);
router.get("/:id", getStatusBarangDetail);
router.post("/", authenticate, adminOnly, createStatusBarangHandler);
router.put("/:id", authenticate, adminOnly, updateStatusBarangHandler);
router.delete("/:id", authenticate, adminOnly, deleteStatusBarangHandler);

export default router;
