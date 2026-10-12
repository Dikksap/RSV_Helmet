import { Router } from "express";
import {
  getStylesHandler,
  getStyleDetail,
  createStyleHandler,
  updateStyleHandler,
  deleteStyleHandler,
} from "../controller/style/style.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getStylesHandler);
router.get("/:id", getStyleDetail);
router.post("/", adminOnly, createStyleHandler);
router.put("/:id", adminOnly, updateStyleHandler);
router.delete("/:id", adminOnly, deleteStyleHandler);

export default router;
