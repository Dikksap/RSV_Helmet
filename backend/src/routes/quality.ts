import { Router } from "express";
import {
  claimWipRejectHandler,
  createWipRejectHandler,
  createWipRejectReasonHandler,
  createWipRejectRepairAttemptHandler,
  listRoutingsHandler,
  listWipRejectOptionsHandler,
  listWipRejectReasonsHandler,
  listWipRejectsHandler,
  replaceRoutingHandler,
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

// Routing produksi: dibutuhkan agar posting HP dapat divalidasi tanpa seed/DB manual.
router.get(
  "/routings",
  requirePermission("QUALITY_VIEW", "QUALITY_INSPECT", "BOM_KELOLA"),
  listRoutingsHandler,
);
router.put(
  "/routings",
  requirePermission("QUALITY_ROUTING_MANAGE", "BOM_KELOLA"),
  replaceRoutingHandler,
);

export default router;
