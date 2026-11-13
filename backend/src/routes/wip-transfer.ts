import { Router } from "express";
import {
  getStokSumberWipHandler,
  createWipTransferHandler,
  directAddWipHandler,
} from "../controller/wipTransfer/wipTransfer.controller.js";
import { authenticate, authorize, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize, requireRole("produksi", "admin", "gudang"));

router.get("/stok-sumber", getStokSumberWipHandler);
router.post("/", createWipTransferHandler);
router.post("/adjust", directAddWipHandler);

export default router;

