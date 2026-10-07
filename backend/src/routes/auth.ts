import { Router } from "express";
import { login, logout, me } from "../controller/auth/auth.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", authenticate, me);
router.post("/logout", authenticate, logout);

export default router;