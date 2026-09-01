import { Request, Response } from "express";
import {
  bulkUpdateBarangStatus,
  updateBarangStatus,
} from "../../model/barang/barang.js";
import { broadcast } from "../../websocket/socket.js";
import { errorMessage, errorStatus, isValidStatus } from "./helpers.js";
import type { StatusBarang } from "../../model/barang/barang.js";

export async function updateStatusBarangHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { status, keterangan } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    if (!isValidStatus(status)) {
      return res.status(400).json({
        message:
          "Field 'status' wajib diisi dan harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    const barang = await updateBarangStatus(id, status, keterangan);

    await broadcast({
      type: "barang.status_updated",
      message: `Status barang ${barang.kodeBarang} diubah menjadi ${status}`,
      data: barang,
    });

    res.status(200).json(barang);
  } catch (error) {
    const message = errorMessage(error, "Gagal update status barang");
    res.status(errorStatus(message)).json({ message });
  }
}

export async function bulkStatusBarangHandler(req: Request, res: Response) {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Field 'items' wajib diisi dan berupa array minimal 1 item",
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        message: "Field 'items' maksimal 500 per request",
      });
    }

    for (const item of items) {
      if (!item || typeof item.id !== "number" || Number.isNaN(item.id)) {
        return res.status(400).json({
          message: "Setiap item harus memiliki 'id' berupa angka",
        });
      }
      if (!isValidStatus(item.status)) {
        return res.status(400).json({
          message:
            "Setiap item.status harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
        });
      }
    }

    const normalized = items.map((it: any) => ({
      id: Number(it.id),
      status: it.status as StatusBarang,
      keterangan: typeof it.keterangan === "string" ? it.keterangan : undefined,
    }));

    const result = await bulkUpdateBarangStatus(normalized);

    for (const barang of result.success) {
      await broadcast({
        type: "barang.status_updated",
        message: `Status barang ${barang.kodeBarang} diubah menjadi ${barang.status}`,
        data: barang,
      });
    }

    res.status(200).json({
      success: result.success,
      failed: result.failed,
      summary: {
        total: normalized.length,
        success: result.success.length,
        failed: result.failed.length,
      },
    });
  } catch (error) {
    const message = errorMessage(error, "Gagal bulk update status barang");
    res.status(500).json({ message });
  }
}
