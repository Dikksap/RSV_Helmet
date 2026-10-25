import { Router } from "express";
import {
  createRepairAttemptHandler,
  createWipRejectHandler,
  createWipRejectReasonHandler,
  createWipRejectRepairAttemptHandler,
  createWipStocktakeHandler,
  createQualityInspectionHandler,
  finalizeQualityInspectionHandler,
  getQualityInspectionHandler,
  listQualityLotsHandler,
  listQualityInspectionsHandler,
  listQualityVariantsHandler,
  listProductionRoutingsHandler,
  getWipFlowReportHandler,
  getQualityDailyReportHandler,
  listWipRejectOptionsHandler,
  listWipRejectReasonsHandler,
  listWipRejectsHandler,
  listWipStocktakeOptionsHandler,
  listWipStocktakesHandler,
  listRepairAssignmentsHandler,
  reopenQualityInspectionHandler,
  reviewRepairAttemptHandler,
  saveProductionRoutingHandler,
  claimWipRejectHandler,
  reviewWipRejectRepairHandler,
  updateQualityInspectionLineHandler,
} from "../controller/quality/quality.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.get("/daily-report", requirePermission("QUALITY_VIEW", "QUALITY_INSPECT"), getQualityDailyReportHandler);
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
router.get("/lots", requirePermission("QUALITY_VIEW", "QUALITY_INSPECT"), listQualityLotsHandler);
router.get("/variants", requirePermission("QUALITY_VIEW", "QUALITY_INSPECT", "QUALITY_ROUTING_MANAGE"), listQualityVariantsHandler);
router.get("/routings", requirePermission("QUALITY_ROUTING_MANAGE"), listProductionRoutingsHandler);
router.put("/routings/:variantId", requirePermission("QUALITY_ROUTING_MANAGE"), saveProductionRoutingHandler);
router.get("/wip-flow", requirePermission("INVENTORY_VIEW", "QUALITY_VIEW"), getWipFlowReportHandler);
router.get("/wip-stocktake/options", requirePermission("INVENTORY_VIEW", "INVENTORY_ADJUST"), listWipStocktakeOptionsHandler);
router.get("/wip-stocktake", requirePermission("INVENTORY_VIEW", "INVENTORY_ADJUST"), listWipStocktakesHandler);
router.post("/wip-stocktake", requirePermission("INVENTORY_ADJUST"), createWipStocktakeHandler);
router.get("/inspections", requirePermission("QUALITY_VIEW"), listQualityInspectionsHandler);
router.post("/inspections", requirePermission("QUALITY_INSPECT"), createQualityInspectionHandler);
router.put(
  "/inspections/:id/lines/:lineId",
  requirePermission("QUALITY_INSPECT"),
  updateQualityInspectionLineHandler,
);
router.get("/inspections/:id", requirePermission("QUALITY_VIEW"), getQualityInspectionHandler);
router.post(
  "/inspections/:id/finalize",
  requirePermission("QUALITY_FINALIZE"),
  finalizeQualityInspectionHandler,
);
router.post(
  "/inspections/:id/reopen",
  requirePermission("QUALITY_REOPEN"),
  reopenQualityInspectionHandler,
);
router.get(
  "/repairs",
  requirePermission("QUALITY_VIEW", "REPAIR_WORK"),
  listRepairAssignmentsHandler,
);
router.post("/repairs/:id/attempts", requirePermission("REPAIR_WORK"), createRepairAttemptHandler);
router.post(
  "/repairs/:id/attempts/:attemptId/review",
  requirePermission("QUALITY_FINALIZE"),
  reviewRepairAttemptHandler,
);

export default router;
