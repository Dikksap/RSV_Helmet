import { Router } from "express";
import {
  approveStockAdjustmentHandler,
  getInventoryBalancesHandler,
  getInventoryLocationsHandler,
  getInventoryItemSummaryHandler,
  getInventoryItemTotalsHandler,
  getInventoryMovementsHandler,
  listUnmappedLegacyItemsHandler,
  listStockAdjustmentsHandler,
  mapDivisionLocationHandler,
  mapWarehouseLocationHandler,
  postInventoryMovementHandler,
  rejectStockAdjustmentHandler,
  requestStockAdjustmentHandler,
  setItemDefaultLocationHandler,
} from "../controller/inventory/inventory.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.get("/locations", requirePermission("INVENTORY_VIEW", "INVENTORY_ADJUST_APPROVE"), getInventoryLocationsHandler);
router.post("/locations/warehouse", requirePermission("INVENTORY_LOCATION_MANAGE"), mapWarehouseLocationHandler);
router.post("/locations/division", requirePermission("INVENTORY_LOCATION_MANAGE"), mapDivisionLocationHandler);
router.get("/items/unmapped-legacy", requirePermission("INVENTORY_LOCATION_MANAGE"), listUnmappedLegacyItemsHandler);
router.put("/items/:itemId/default-location", requirePermission("INVENTORY_LOCATION_MANAGE"), setItemDefaultLocationHandler);
router.get("/balances", requirePermission("INVENTORY_VIEW"), getInventoryBalancesHandler);
router.post("/items/summary", requirePermission("INVENTORY_VIEW"), getInventoryItemSummaryHandler);
router.post("/items/totals", requirePermission("INVENTORY_VIEW"), getInventoryItemTotalsHandler);
router.get("/movements", requirePermission("INVENTORY_VIEW"), getInventoryMovementsHandler);
router.post("/movements", requirePermission("INVENTORY_MOVE", "INVENTORY_ADJUST"), postInventoryMovementHandler);
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
