import { Router } from "express";
import { login, logout } from "../controller/auth/auth.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.post("/logout", authenticate, logout);

export default router;