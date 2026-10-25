import { Router } from "express";
import {
  getInventoryBalancesHandler,
  getInventoryLocationsHandler,
  getInventoryMovementsHandler,
  mapDivisionLocationHandler,
  mapWarehouseLocationHandler,
  postInventoryMovementHandler,
  reverseInventoryMovementHandler,
} from "../controller/inventory/inventory.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/locations", requirePermission("INVENTORY_VIEW"), getInventoryLocationsHandler);
router.post(
  "/locations/warehouse",
  requirePermission("INVENTORY_LOCATION_MANAGE"),
  mapWarehouseLocationHandler,
);
router.post(
  "/locations/division",
  requirePermission("INVENTORY_LOCATION_MANAGE"),
  mapDivisionLocationHandler,
);
router.get("/balances", requirePermission("INVENTORY_VIEW"), getInventoryBalancesHandler);
router.get("/movements", requirePermission("INVENTORY_VIEW"), getInventoryMovementsHandler);
router.post(
  "/movements",
  requirePermission("INVENTORY_MOVE", "INVENTORY_ADJUST"),
  postInventoryMovementHandler,
);
router.post(
  "/movements/:id/reversal",
  requirePermission("INVENTORY_ADJUST"),
  reverseInventoryMovementHandler,
);

export default router;
