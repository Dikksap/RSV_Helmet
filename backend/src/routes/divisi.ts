import { Router } from "express";
import {
  getDivisiHandler,
  getDivisiDetail,
  createDivisiHandler,
  updateDivisiHandler,
  deleteDivisiHandler,
} from "../controller/divisi/divisi.js";

const router = Router();

router.get("/", getDivisiHandler);
router.get("/:id", getDivisiDetail);
router.post("/", createDivisiHandler);
router.put("/:id", updateDivisiHandler);
router.delete("/:id", deleteDivisiHandler);

export default router;
