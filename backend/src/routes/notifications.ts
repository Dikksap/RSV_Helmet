import { Router } from "express";
import {
  listNotificationsHandler,
  clearNotificationsHandler,
} from "../controller/notification/notification.js";
import { authenticate, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", listNotificationsHandler);
router.delete("/", adminOnly, clearNotificationsHandler);

export default router;
