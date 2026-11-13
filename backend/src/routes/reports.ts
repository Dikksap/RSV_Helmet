import { Router } from "express";
import {
  getFinishedGoodsSummaryHandler,
  getMaterialConsumptionHandler,
  getReconciliationHandler,
  getTraceabilityHandler,
} from "../controller/reports/reports.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.use(requirePermission("BARANG_STATISTIK_LIHAT", "INVENTORY_VIEW", "QUALITY_VIEW"));

router.get("/finished-goods/summary", getFinishedGoodsSummaryHandler);
router.get("/material-consumption", getMaterialConsumptionHandler);
router.get("/traceability", getTraceabilityHandler);
router.get("/reconciliation", getReconciliationHandler);

export default router;
