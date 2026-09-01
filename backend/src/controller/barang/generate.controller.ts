import { Request, Response } from "express";
import {
  generateBarangBulk,
  getGenerateInfo,
} from "../../model/barang/barang.js";
import { broadcast } from "../../websocket/socket.js";
import { errorMessage, errorStatus } from "./helpers.js";

export async function getGenerateInfoHandler(req: Request, res: Response) {
  try {
    const variantId = Number(req.query.variantId);

    if (!req.query.variantId || Number.isNaN(variantId)) {
      return res.status(400).json({
        message: "Query parameter 'variantId' wajib diisi dan berupa angka",
      });
    }

    const info = await getGenerateInfo(variantId);
    res.status(200).json(info);
  } catch (error) {
    const message = errorMessage(error, "Gagal mengambil info generate");
    res.status(errorStatus(message)).json({ message });
  }
}

export async function generateBarang(req: Request, res: Response) {
  try {
    const { variantId, jumlah } = req.body;

    if (!variantId || Number.isNaN(Number(variantId))) {
      return res.status(400).json({
        message: "Field 'variantId' wajib diisi dan berupa angka",
      });
    }

    const jumlahNum = Number(jumlah);
    if (!jumlah || Number.isNaN(jumlahNum) || jumlahNum < 1) {
      return res.status(400).json({
        message: "Field 'jumlah' wajib diisi, berupa angka, dan minimal 1",
      });
    }

    if (jumlahNum > 50000) {
      return res.status(400).json({
        message: "Field 'jumlah' maksimal 50000 per request",
      });
    }

    const result = await generateBarangBulk(Number(variantId), jumlahNum);

    await broadcast({
      type: "barang.generated",
      message: `${result.totalDibuat} barang berhasil digenerate`,
      data: result,
    });

    res.status(201).json({
      message: `${result.totalDibuat} barang berhasil digenerate`,
      totalDibuat: result.totalDibuat,
      batches: result.batches,
    });
  } catch (error) {
    const message = errorMessage(error, "Gagal generate barang");
    const status = message.includes("tidak ditemukan")
      ? 404
      : message.includes("Jumlah")
        ? 400
        : 500;
    res.status(status).json({ message });
  }
}
