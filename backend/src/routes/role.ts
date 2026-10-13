import { Router } from "express";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";
import {
  createRoleHandler,
  getRoleDetailHandler,
  listPermissionsHandler,
  listRolesHandler,
  setRoleBarangStatusHandler,
  setRolePermissionsHandler,
} from "../controller/role/role.js";

const router = Router();

router.use(authenticate, authorize, requirePermission("ROLE_KELOLA"));

router.get("/", listRolesHandler);
router.post("/", createRoleHandler);
router.get("/permissions", listPermissionsHandler);
router.get("/:id", getRoleDetailHandler);
router.put("/:id/permissions", setRolePermissionsHandler);
router.put("/:id/barang-status", setRoleBarangStatusHandler);

export default router;
