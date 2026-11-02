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
import { authenticate, adminOnly, authorize, requireRole } from "../middleware/auth.js";

const router = Router();

// Public: form permintaan diisi user tanpa login.
router.post("/", createPermintaanHandler);

router.use(authenticate);

router.get("/", authorize, listPermintaanHandler);
router.get("/:id", authorize, getPermintaanHandler);
router.put("/:id", adminOnly, updatePermintaanHandler);
router.patch("/:id/approval", authorize, requireRole("admin", "gudang"), setApprovalHandler);
router.patch("/:id/items/:barangItemId", authorize, requireRole("admin", "gudang"), petakanItemHandler);
router.delete("/:id", adminOnly, deletePermintaanHandler);

export default router;
