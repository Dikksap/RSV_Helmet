import { Router } from "express";
import {
  listItemsHandler,
  getItemDetail,
  createItemHandler,
  updateItemHandler,
  deleteItemHandler,
} from "../controller/item/item.js";
import { tambahStokHandler, getStokItemHandler, getSaldoBulkHandler } from "../controller/stokItem/stokItem.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

// List + detail publik: dipakai dropdown form permintaan tanpa login.
router.get("/", listItemsHandler);
router.get("/:id", getItemDetail);

router.use(authenticate);

router.post("/", authorize, requirePermission("KELOLA_ITEM"), createItemHandler);
router.put("/:id", authorize, requirePermission("KELOLA_ITEM"), updateItemHandler);
router.delete("/:id", authorize, requirePermission("KELOLA_ITEM"), deleteItemHandler);

router.get("/:id/stok", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getStokItemHandler);
router.post("/:id/stok", authorize, requirePermission("KELOLA_ITEM"), tambahStokHandler);
router.post("/stok-saldo", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getSaldoBulkHandler);

export default router;
