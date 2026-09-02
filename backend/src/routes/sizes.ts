import { Router } from "express";
import {
  getSizesHandler,
  getSizeDetail,
  createSizeHandler,
  updateSizeHandler,
  deleteSizeHandler,
} from "../controller/size/size.js";

const router = Router();

router.get("/", getSizesHandler);
router.get("/:id", getSizeDetail);
router.post("/", createSizeHandler);
router.put("/:id", updateSizeHandler);
router.delete("/:id", deleteSizeHandler);

export default router;
