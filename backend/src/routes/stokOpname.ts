import { Router } from "express";
import {
  buatSesiOpnameHandler,
  listSesiOpnameHandler,
  getSesiOpnameHandler,
} from "../controller/stokOpname/stokOpname.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize, requirePermission("KELOLA_ITEM"), buatSesiOpnameHandler);
router.get("/", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), listSesiOpnameHandler);
router.get("/:id", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getSesiOpnameHandler);

export default router;
