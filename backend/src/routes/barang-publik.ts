import { Router } from "express";
import {
  getPublicBarangHandler,
  getPublicRekapVariantHandler,
  listPublicBarangHandler,
} from "../controller/barang/public.controller.js";

const router = Router();

// Read-only publik, tanpa auth: dipakai untuk cek unit barang dari luar aplikasi.
router.get("/", listPublicBarangHandler);
// Didaftarkan sebelum "/:kodeBarang" supaya tidak dianggap kode barang.
router.get("/rekap-variant", getPublicRekapVariantHandler);
router.get("/:kodeBarang", getPublicBarangHandler);

export default router;
