import { Router } from "express";
import { authenticate, adminOnly } from "../middleware/auth.js";
import {
  getUsersHandler,
  getUserDetail,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../controller/user/user.js";

const router = Router();

router.use(authenticate, adminOnly);

router.get("/", getUsersHandler);
router.get("/:id", getUserDetail);
router.post("/", createUserHandler);
router.put("/:id", updateUserHandler);
router.delete("/:id", deleteUserHandler);

export default router;
