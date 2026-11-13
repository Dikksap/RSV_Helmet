import { Router } from "express";
import {
  createGudangHandler,
  deleteGudangHandler,
  listGudangHandler,
  setGudangJenisHandler,
  updateGudangHandler,
} from "../controller/gudang/gudang.js";
import { authenticate, authorize, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/", listGudangHandler);
router.post("/", adminOnly, createGudangHandler);
router.put("/:id", adminOnly, updateGudangHandler);
router.delete("/:id", adminOnly, deleteGudangHandler);
router.put("/:id/jenis", adminOnly, setGudangJenisHandler);

export default router;
