import { Router } from "express";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", authenticate, adminOnly, (_req, res) => {
  res.status(200).json({ message: "Admin dashboard", user: _req.user });
});

export default router;