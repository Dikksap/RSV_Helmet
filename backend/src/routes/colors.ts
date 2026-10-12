import { Router } from "express";
import {
  getColorsHandler,
  getColorDetail,
  createColorHandler,
  updateColorHandler,
  deleteColorHandler,
} from "../controller/color/color.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getColorsHandler);
router.get("/:id", getColorDetail);
router.post("/", adminOnly, createColorHandler);
router.put("/:id", adminOnly, updateColorHandler);
router.delete("/:id", adminOnly, deleteColorHandler);

export default router;
