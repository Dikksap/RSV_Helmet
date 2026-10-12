import { Router } from "express";
import {
  listPermintaanHandler,
  getPermintaanHandler,
  createPermintaanHandler,
  updatePermintaanHandler,
  setApprovalHandler,
  deletePermintaanHandler,
} from "../controller/permintaanBarang/permintaanBarang.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

// Public: form permintaan diisi user tanpa login.
router.post("/", createPermintaanHandler);

router.use(authenticate);

router.get("/", listPermintaanHandler);
router.get("/:id", getPermintaanHandler);
router.put("/:id", adminOnly, updatePermintaanHandler);
router.patch("/:id/approval", adminOnly, setApprovalHandler);
router.delete("/:id", adminOnly, deletePermintaanHandler);

export default router;
