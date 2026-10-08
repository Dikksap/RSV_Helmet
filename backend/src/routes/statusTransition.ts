import { Router } from "express";
import {
  getTransitionsHandler,
  setTransitionsHandler,
  deleteTransitionHandler,
} from "../controller/statusTransition/statusTransition.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", getTransitionsHandler);
router.put("/:fromKode", authenticate, adminOnly, setTransitionsHandler);
router.delete("/:fromKode/:toKode", authenticate, adminOnly, deleteTransitionHandler);

export default router;
