import { Router } from "express";
import {
  listBomsHandler,
  getBomDetail,
  createBomHandler,
  updateBomHandler,
  deleteBomHandler,
} from "../controller/bom/bom.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/", listBomsHandler);
router.get("/:id", getBomDetail);
router.post("/", authorize, requirePermission("BOM_KELOLA"), createBomHandler);
router.put("/:id", authorize, requirePermission("BOM_KELOLA"), updateBomHandler);
router.delete("/:id", authorize, requirePermission("BOM_KELOLA"), deleteBomHandler);

export default router;
