import { Router } from "express";
import {
  getBatchHandler,
  getBatchDetail,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
} from "../controller/batch/batch.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getBatchHandler);
router.get("/:id", getBatchDetail);
router.post("/", adminOnly, createBatchHandler);
router.put("/:id", adminOnly, updateBatchHandler);
router.delete("/:id", adminOnly, deleteBatchHandler);

export default router;
