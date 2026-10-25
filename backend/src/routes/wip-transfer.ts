import { Router } from "express";
import {
  approveWipTransferHandler,
  createWipTransferHandler,
  deleteWipTransferHandler,
  getWipTransferHandler,
  getWipTransferOpsiHandler,
  listWipTransferHandler,
} from "../controller/wipTransfer/wipTransfer.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/opsi", getWipTransferOpsiHandler);
router.get("/", listWipTransferHandler);
router.post("/", createWipTransferHandler);
router.get("/:id", getWipTransferHandler);
router.patch("/:id/approval", approveWipTransferHandler);
router.delete("/:id", deleteWipTransferHandler);

export default router;
