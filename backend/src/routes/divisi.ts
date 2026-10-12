import { Router } from "express";
import {
  getDivisiHandler,
  getDivisiDetail,
  createDivisiHandler,
  updateDivisiHandler,
  deleteDivisiHandler,
} from "../controller/divisi/divisi.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getDivisiHandler);
router.get("/:id", getDivisiDetail);
router.post("/", adminOnly, createDivisiHandler);
router.put("/:id", adminOnly, updateDivisiHandler);
router.delete("/:id", adminOnly, deleteDivisiHandler);

export default router;
