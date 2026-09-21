import { Router } from "express";
import { getJurnalProductsHandler } from "../controller/integrasi-jurnal/integrasi-jurnal.js";

const router = Router();

router.get("/products", getJurnalProductsHandler);

export default router;
