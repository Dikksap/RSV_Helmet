import { Router } from "express";
import {
  listItemsHandler,
  getItemDetail,
  createItemHandler,
  updateItemHandler,
  deleteItemHandler,
  bulkUpdateItemsHandler,
} from "../controller/item/item.js";
import { tambahStokHandler, keluarStokHandler, getStokItemHandler, getSaldoBulkHandler, getRingkasanBulkHandler } from "../controller/stokItem/stokItem.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";

const router = Router();

// List + detail publik: dipakai dropdown form permintaan tanpa login.
router.get("/", listItemsHandler);
router.get("/:id", getItemDetail);

router.use(authenticate);

router.post("/", authorize, requirePermission("KELOLA_ITEM"), createItemHandler);
// Daftarkan sebelum "/:id" supaya "bulk" tidak dimakan param :id.
router.put("/bulk", authorize, requirePermission("KELOLA_ITEM"), bulkUpdateItemsHandler);
router.put("/:id", authorize, requirePermission("KELOLA_ITEM"), updateItemHandler);
router.delete("/:id", authorize, requirePermission("KELOLA_ITEM"), deleteItemHandler);

router.get("/:id/stok", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getStokItemHandler);
router.post("/:id/stok", authorize, requirePermission("KELOLA_ITEM"), tambahStokHandler);
router.post("/:id/stok/keluar", authorize, requirePermission("KELOLA_ITEM"), keluarStokHandler);
router.post("/stok-saldo", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getSaldoBulkHandler);
router.post("/stok-ringkasan", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getRingkasanBulkHandler);

export default router;
