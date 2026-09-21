import type { Request, Response } from "express";
import { mekariConfigured, mekariGet } from "../../lib/mekari.js";

export async function getJurnalProductsHandler(req: Request, res: Response) {
  try {
    if (!mekariConfigured()) {
      return res.status(500).json({
        message: "Integrasi Jurnal belum dikonfigurasi (MEKARI_CLIENT_ID / MEKARI_CLIENT_SECRET kosong)",
      });
    }
    const arch = req.query.include_archive === "false" ? "?include_archive=false" : "";
    const { data } = await mekariGet(`/public/jurnal/api/v1/products${arch}`);
    res.status(200).json(data);
  } catch (error: any) {
    if (error?.code === "MEKARI_NO_CRED") {
      return res.status(500).json({ message: error.message });
    }
    if (error?.code === "MEKARI_UPSTREAM") {
      return res.status(502).json({ message: error.message, detail: error.data ?? null });
    }
    res.status(500).json({ message: "Gagal mengambil produk Jurnal", error });
  }
}
