import { Router } from "express";
import {
  deleteMyAvatar,
  getMyAvatar,
  googleLogin,
  login,
  logout,
  me,
  updateMe,
  uploadMyAvatar,
} from "../controller/auth/auth.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { receiveImage } from "../lib/imageStorage.js";

const router = Router();

router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", authenticate, authorize, me);
router.put("/me", authenticate, authorize, updateMe);
router.get("/me/avatar", authenticate, getMyAvatar);
router.post("/me/avatar", authenticate, receiveImage, uploadMyAvatar);
router.delete("/me/avatar", authenticate, deleteMyAvatar);
router.post("/logout", authenticate, logout);

export default router;