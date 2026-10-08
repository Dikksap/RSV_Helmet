import { Router } from "express";
import {
  listNotificationsHandler,
  clearNotificationsHandler,
} from "../controller/notification/notification.js";

const router = Router();

router.get("/", listNotificationsHandler);
router.delete("/", clearNotificationsHandler);

export default router;
