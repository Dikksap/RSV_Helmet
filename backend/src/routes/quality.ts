import { Router } from "express";
import {
  claimWipRejectHandler,
  createWipRejectHandler,
  createWipRejectReasonHandler,
  createWipRejectRepairAttemptHandler,
  listWipRejectOptionsHandler,
  listWipRejectReasonsHandler,
  listWipRejectsHandler,
  reviewWipRejectRepairHandler,
} from "../controller/quality/quality.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.get("/wip-rejects/options", requirePermission("QUALITY_INSPECT"), listWipRejectOptionsHandler);
router.get("/wip-rejects/reasons", requirePermission("QUALITY_INSPECT"), listWipRejectReasonsHandler);
router.post("/wip-rejects/reasons", requirePermission("QUALITY_INSPECT"), createWipRejectReasonHandler);
router.get("/wip-rejects", requirePermission("QUALITY_VIEW", "QUALITY_INSPECT", "REPAIR_WORK"), listWipRejectsHandler);
router.post("/wip-rejects", requirePermission("QUALITY_INSPECT"), createWipRejectHandler);
router.post("/wip-rejects/:id/claim", requirePermission("REPAIR_WORK"), claimWipRejectHandler);
router.post("/wip-rejects/:id/attempts", requirePermission("REPAIR_WORK"), createWipRejectRepairAttemptHandler);
router.post(
  "/wip-rejects/:id/attempts/:attemptId/review",
  requirePermission("QUALITY_FINALIZE"),
  reviewWipRejectRepairHandler,
);
export default router;
