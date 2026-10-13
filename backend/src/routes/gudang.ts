import { Router } from "express";
import {
  listGudangHandler,
  getGudangDetail,
  createGudangHandler,
  updateGudangHandler,
  deleteGudangHandler,
} from "../controller/gudang/gudang.js";
import { authenticate, authorize, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/", listGudangHandler);
router.get("/:id", getGudangDetail);
router.post("/", adminOnly, createGudangHandler);
router.put("/:id", adminOnly, updateGudangHandler);
router.delete("/:id", adminOnly, deleteGudangHandler);

export default router;
