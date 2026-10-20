import { Router } from "express";
import {
  listSubassembliesHandler,
  getSubassemblyDetail,
  createSubassemblyHandler,
  updateSubassemblyHandler,
  deleteSubassemblyHandler,
  syncSubassembliesHandler,
} from "../controller/subassembly/subassembly.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/", listSubassembliesHandler);
router.get("/:id", getSubassemblyDetail);
router.post("/sync", authorize, requirePermission("BOM_KELOLA"), syncSubassembliesHandler);
router.post("/", authorize, requirePermission("BOM_KELOLA"), createSubassemblyHandler);
router.put("/:id", authorize, requirePermission("BOM_KELOLA"), updateSubassemblyHandler);
router.delete("/:id", authorize, requirePermission("BOM_KELOLA"), deleteSubassemblyHandler);

export default router;
