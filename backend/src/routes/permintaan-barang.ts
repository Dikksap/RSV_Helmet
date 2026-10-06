import { Router } from "express";
import {
  listPermintaanHandler,
  getPermintaanHandler,
  createPermintaanHandler,
  updatePermintaanHandler,
  setApprovalHandler,
  deletePermintaanHandler,
} from "../controller/permintaanBarang/permintaanBarang.js";

const router = Router();

router.get("/", listPermintaanHandler);
router.get("/:id", getPermintaanHandler);
router.post("/", createPermintaanHandler);
router.put("/:id", updatePermintaanHandler);
router.patch("/:id/approval", setApprovalHandler);
router.delete("/:id", deletePermintaanHandler);

export default router;
