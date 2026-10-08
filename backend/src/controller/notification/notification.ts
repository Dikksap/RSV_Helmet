import type { Request, Response } from "express";
import { clearNotifs, listNotifs } from "../../lib/notificationCache.js";

export async function listNotificationsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const items = await listNotifs();
  res.status(200).json({ items });
}

export async function clearNotificationsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  await clearNotifs();
  res.status(200).json({ message: "Notifikasi dibersihkan" });
}
