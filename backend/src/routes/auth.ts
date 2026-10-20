import { Router } from "express";
import { login, logout, me, updateMe } from "../controller/auth/auth.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", authenticate, authorize, me);
router.put("/me", authenticate, authorize, updateMe);
router.post("/logout", authenticate, logout);

export default router;