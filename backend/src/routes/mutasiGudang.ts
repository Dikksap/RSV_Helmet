import { Router } from "express";
import {
  catatMutasiHandler,
  catatMutasiBulkHandler,
  listMutasiHandler,
  getMutasiBarangHandler,
  getMutasiGudangHandler,
} from "../controller/mutasiGudang/mutasiGudang.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/", requirePermission("BARANG_LIHAT"), listMutasiHandler);
router.get("/barang/:barangId", requirePermission("BARANG_LIHAT"), getMutasiBarangHandler);
router.get("/gudang/:gudangId", requirePermission("BARANG_LIHAT"), getMutasiGudangHandler);
router.post("/", requirePermission("MUTASI_GUDANG"), catatMutasiHandler);
router.post("/bulk", requirePermission("MUTASI_GUDANG"), catatMutasiBulkHandler);

export default router;
