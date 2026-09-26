import { Router } from "express";
import {
  getOrdersHandler,
  getOrderDetail,
  createOrderHandler,
  updateOrderHandler,
  deleteOrderHandler,
  addOrderItemHandler,
  updateOrderItemHandler,
  deleteOrderItemHandler,
  getCapacitiesHandler,
  replaceCapacitiesHandler,
  getScheduleHandler,
  saveScheduleTargetHandler,
  saveScheduleAllocHandler,
  getRealisasiHandler,
  saveRealisasiHandler,
} from "../controller/production-order/production-order.js";

const router = Router();

router.get("/", getOrdersHandler);
router.get("/:id", getOrderDetail);
router.post("/", createOrderHandler);
router.put("/:id", updateOrderHandler);
router.delete("/:id", deleteOrderHandler);
router.post("/:id/items", addOrderItemHandler);
router.put("/:id/items/:itemId", updateOrderItemHandler);
router.delete("/:id/items/:itemId", deleteOrderItemHandler);
router.get("/:id/capacities", getCapacitiesHandler);
router.put("/:id/capacities", replaceCapacitiesHandler);
router.get("/:id/schedule", getScheduleHandler);
router.put("/:id/schedule/targets", saveScheduleTargetHandler);
router.put("/:id/schedule/allocs", saveScheduleAllocHandler);
router.get("/:id/realisasi", getRealisasiHandler);
router.put("/:id/realisasi", saveRealisasiHandler);

export default router;
