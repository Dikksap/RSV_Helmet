import { Router } from "express";
import {
  getColorsHandler,
  getColorDetail,
  createColorHandler,
  updateColorHandler,
  deleteColorHandler,
} from "../controller/color/color.js";

const router = Router();

router.get("/", getColorsHandler);
router.get("/:id", getColorDetail);
router.post("/", createColorHandler);
router.put("/:id", updateColorHandler);
router.delete("/:id", deleteColorHandler);

export default router;
