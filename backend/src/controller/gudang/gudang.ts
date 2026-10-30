import type { Request, Response } from "express";
import { listGudang } from "../../model/gudang/gudang.js";
import { barangScope } from "../barang/helpers.js";

// GET /api/gudang
export async function listGudangHandler(req: Request, res: Response) {
  try {
    res.status(200).json(await listGudang(barangScope(req)));
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data gudang", error });
  }
}
