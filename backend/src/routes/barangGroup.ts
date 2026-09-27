import { Router } from "express";
import {
  getBarangGroupListHandler,
  getBarangGroupDetailHandler,
  createBarangGroupHandler,
  updateBarangGroupHandler,
  deleteBarangGroupHandler,
  assignBarangHandler,
  unassignBarangHandler,
} from "../controller/barangGroup/barangGroup.js";

const router = Router();

router.get("/", getBarangGroupListHandler);
router.get("/:id", getBarangGroupDetailHandler);
router.post("/", createBarangGroupHandler);
router.put("/:id", updateBarangGroupHandler);
router.delete("/:id", deleteBarangGroupHandler);
router.post("/:id/assign", assignBarangHandler);
router.post("/:id/unassign", unassignBarangHandler);

export default router;
