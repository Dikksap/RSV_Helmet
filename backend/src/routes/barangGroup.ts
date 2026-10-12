import { Router } from "express";
import {
  getBarangGroupListHandler,
  getBarangGroupDetailHandler,
  getBarangGroupBarangsHandler,
  createBarangGroupHandler,
  updateBarangGroupHandler,
  deleteBarangGroupHandler,
  assignBarangHandler,
  unassignBarangHandler,
} from "../controller/barangGroup/barangGroup.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireRole("admin", "user"));

router.get("/", getBarangGroupListHandler);
router.get("/:id", getBarangGroupDetailHandler);
router.get("/:id/barangs", getBarangGroupBarangsHandler);
router.post("/", createBarangGroupHandler);
router.put("/:id", updateBarangGroupHandler);
router.delete("/:id", deleteBarangGroupHandler);
router.post("/:id/assign", assignBarangHandler);
router.post("/:id/unassign", unassignBarangHandler);

export default router;
