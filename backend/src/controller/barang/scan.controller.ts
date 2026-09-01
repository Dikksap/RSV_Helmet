import { Request, Response } from "express";
import { bulkScanBarang, scanBarang } from "../../model/barang/barang.js";
import { broadcast } from "../../websocket/socket.js";
import { errorMessage, errorStatus, isValidStatus } from "./helpers.js";

export async function scanBarangHandler(req: Request, res: Response) {
  try {
    const { kodeBarang } = req.params;

    if (!kodeBarang) {
      return res.status(400).json({
        message: "Parameter 'kodeBarang' wajib diisi",
      });
    }

    const barang = await scanBarang(kodeBarang);
    res.status(200).json(barang);
  } catch (error) {
    const message = errorMessage(error, "Gagal scan barang");
    res.status(errorStatus(message)).json({ message });
  }
}

export async function bulkScanBarangHandler(req: Request, res: Response) {
  try {
    const { kodeBarang, status, keterangan } = req.body;

    if (!Array.isArray(kodeBarang) || kodeBarang.length === 0) {
      return res.status(400).json({
        message:
          "Field 'kodeBarang' wajib diisi dan berupa array minimal 1 item",
      });
    }

    if (!isValidStatus(status)) {
      return res.status(400).json({
        message:
          "Field 'status' wajib diisi dan harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    const result = await bulkScanBarang(kodeBarang, status, keterangan);

    for (const barang of result.success) {
      await broadcast({
        type: "barang.status_updated",
        message: `Status barang ${barang.kodeBarang} diubah menjadi ${status}`,
        data: barang,
      });
    }

    res.status(200).json({
      success: result.success,
      failed: result.failed,
      summary: {
        total: kodeBarang.length,
        success: result.success.length,
        failed: result.failed.length,
      },
    });
  } catch (error) {
    const message = errorMessage(error, "Gagal bulk scan barang");
    res.status(500).json({ message });
  }
}
