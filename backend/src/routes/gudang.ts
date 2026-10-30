import { Router } from "express";
import {
  listGudangHandler,
} from "../controller/gudang/gudang.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize);

router.get("/", listGudangHandler);

export default router;
