import { Router } from "express";
import {
  getSizesHandler,
  getSizeDetail,
  createSizeHandler,
  updateSizeHandler,
  deleteSizeHandler,
} from "../controller/size/size.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getSizesHandler);
router.get("/:id", getSizeDetail);
router.post("/", adminOnly, createSizeHandler);
router.put("/:id", adminOnly, updateSizeHandler);
router.delete("/:id", adminOnly, deleteSizeHandler);

export default router;
