import { Router } from "express";
import {
  getBatchHandler,
  getBatchDetail,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
} from "../controller/batch/batch.js";

const router = Router();

router.get("/", getBatchHandler);
router.get("/:id", getBatchDetail);
router.post("/", createBatchHandler);
router.put("/:id", updateBatchHandler);
router.delete("/:id", deleteBatchHandler);

export default router;
