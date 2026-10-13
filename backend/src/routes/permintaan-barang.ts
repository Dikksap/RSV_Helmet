import { Router } from "express";
import {
  listPermintaanHandler,
  getPermintaanHandler,
  createPermintaanHandler,
  updatePermintaanHandler,
  setApprovalHandler,
  petakanItemHandler,
  deletePermintaanHandler,
} from "../controller/permintaanBarang/permintaanBarang.js";
import { authenticate, adminOnly, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

// Public: form permintaan diisi user tanpa login.
router.post("/", createPermintaanHandler);

router.use(authenticate);

router.get("/", listPermintaanHandler);
router.get("/:id", getPermintaanHandler);
router.put("/:id", adminOnly, updatePermintaanHandler);
router.patch("/:id/approval", authorize, requirePermission("KELOLA_ITEM"), setApprovalHandler);
router.patch("/:id/items/:barangItemId", authorize, requirePermission("KELOLA_ITEM"), petakanItemHandler);
router.delete("/:id", adminOnly, deletePermintaanHandler);

export default router;
