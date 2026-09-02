import { Router } from "express";
import {
  getStylesHandler,
  getStyleDetail,
  createStyleHandler,
  updateStyleHandler,
  deleteStyleHandler,
} from "../controller/style/style.js";

const router = Router();

router.get("/", getStylesHandler);
router.get("/:id", getStyleDetail);
router.post("/", createStyleHandler);
router.put("/:id", updateStyleHandler);
router.delete("/:id", deleteStyleHandler);

export default router;
