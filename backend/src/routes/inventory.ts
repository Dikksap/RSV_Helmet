import { Router } from "express";
import {
  approveStockAdjustmentHandler,
  listStockAdjustmentsHandler,
  rejectStockAdjustmentHandler,
  requestStockAdjustmentHandler,
} from "../controller/inventory/inventory.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.get(
  "/adjustments",
  requirePermission("INVENTORY_VIEW", "INVENTORY_ADJUST_APPROVE"),
  listStockAdjustmentsHandler,
);
router.post(
  "/adjustments",
  requirePermission("INVENTORY_ADJUST"),
  requestStockAdjustmentHandler,
);
router.post(
  "/adjustments/:id/approve",
  requirePermission("INVENTORY_ADJUST_APPROVE"),
  approveStockAdjustmentHandler,
);
router.post(
  "/adjustments/:id/reject",
  requirePermission("INVENTORY_ADJUST_APPROVE"),
  rejectStockAdjustmentHandler,
);

export default router;
