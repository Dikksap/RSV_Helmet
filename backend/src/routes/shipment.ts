import { Router } from "express";
import {
  cancelCustomerShipmentHandler,
  createCustomerShipmentHandler,
  getCustomerShipmentHandler,
  listAvailableFinishedGoodsHandler,
  listCustomerShipmentsHandler,
  listFinishedGoodsReceiptCandidatesHandler,
  postCustomerShipmentHandler,
  receiveFinishedGoodsHandler,
  receiveShipmentReturnHandler,
} from "../controller/shipment/shipment.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);
router.get("/", requirePermission("SHIPMENT_VIEW"), listCustomerShipmentsHandler);
router.get(
  "/finished-goods/receipt-candidates",
  requirePermission("SHIPMENT_POST"),
  listFinishedGoodsReceiptCandidatesHandler,
);
router.get(
  "/finished-goods/available",
  requirePermission("SHIPMENT_MANAGE"),
  listAvailableFinishedGoodsHandler,
);
router.post("/", requirePermission("SHIPMENT_MANAGE"), createCustomerShipmentHandler);
router.post(
  "/finished-goods/receive",
  requirePermission("SHIPMENT_POST"),
  receiveFinishedGoodsHandler,
);
router.post("/returns", requirePermission("SHIPMENT_RETURN"), receiveShipmentReturnHandler);
router.get("/:id", requirePermission("SHIPMENT_VIEW"), getCustomerShipmentHandler);
router.post("/:id/post", requirePermission("SHIPMENT_POST"), postCustomerShipmentHandler);
router.post("/:id/cancel", requirePermission("SHIPMENT_MANAGE"), cancelCustomerShipmentHandler);

export default router;
