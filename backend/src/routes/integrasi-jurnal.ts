import { Router } from "express";
import { getJurnalProductsHandler } from "../controller/integrasi-jurnal/integrasi-jurnal.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/products", authenticate, adminOnly, getJurnalProductsHandler);

export default router;
