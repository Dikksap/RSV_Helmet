import { Router } from "express";
import {
  listItemsHandler,
  getItemDetail,
  createItemHandler,
  updateItemHandler,
  deleteItemHandler,
  bulkUpdateItemsHandler,
  deleteItemImageHandler,
  getItemImageHandler,
  uploadItemImageHandler,
} from "../controller/item/item.js";
import {
  tambahStokHandler,
  keluarStokHandler,
  getStokItemHandler,
  getSaldoBulkHandler,
  getSaldoGudangBulkHandler,
  getRingkasanBulkHandler,
  getItemWarehouseBalancesHandler,
  transferItemWarehouseHandler,
} from "../controller/stokItem/stokItem.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";
import { receiveImage } from "../lib/imageStorage.js";

const router = Router();

// List + detail publik: dipakai dropdown form permintaan tanpa login.
router.get("/", listItemsHandler);
router.get("/:id/image", getItemImageHandler);
router.get("/:id", getItemDetail);

router.use(authenticate);

router.post("/", authorize, requirePermission("KELOLA_ITEM"), createItemHandler);
// Daftarkan sebelum "/:id" supaya "bulk" tidak dimakan param :id.
router.put("/bulk", authorize, requirePermission("KELOLA_ITEM"), bulkUpdateItemsHandler);
router.put("/:id", authorize, requirePermission("KELOLA_ITEM"), updateItemHandler);
router.delete("/:id", authorize, requirePermission("KELOLA_ITEM"), deleteItemHandler);
router.post("/:id/image", authorize, requirePermission("KELOLA_ITEM"), receiveImage, uploadItemImageHandler);
router.delete("/:id/image", authorize, requirePermission("KELOLA_ITEM"), deleteItemImageHandler);

router.get("/:id/stok", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getStokItemHandler);
router.get("/:id/stok/gudang", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getItemWarehouseBalancesHandler);
router.post("/:id/stok", authorize, requirePermission("KELOLA_ITEM"), tambahStokHandler);
router.post("/:id/stok/keluar", authorize, requirePermission("KELOLA_ITEM"), keluarStokHandler);
router.post("/:id/stok/transfer", authorize, requirePermission("INVENTORY_MOVE"), transferItemWarehouseHandler);
router.post("/stok-saldo", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getSaldoBulkHandler);
router.post("/stok-saldo-gudang", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getSaldoGudangBulkHandler);
router.post("/stok-ringkasan", authorize, requirePermission("KELOLA_ITEM", "BARANG_LIHAT"), getRingkasanBulkHandler);

export default router;
