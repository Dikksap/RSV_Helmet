import type { Request, Response } from "express";
import {
  getAllTransitions,
  setTransitionsForFrom,
  deleteTransition,
} from "../../model/statusTransition/statusTransition.js";
import prisma from "../../lib/prisma.js";

// GET /api/status-transition
export async function getTransitionsHandler(req: Request, res: Response) {
  try {
    const data = await getAllTransitions();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data transisi status", error });
  }
}

// PUT /api/status-transition/:fromKode  { toKodes: string[] }
export async function setTransitionsHandler(req: Request, res: Response) {
  try {
    const fromKode = String(req.params.fromKode ?? "").trim().toUpperCase();
    const { toKodes } = req.body ?? {};
    if (!fromKode) return res.status(400).json({ message: "fromKode wajib diisi" });
    if (!Array.isArray(toKodes) || toKodes.some((t) => typeof t !== "string")) {
      return res.status(400).json({ message: "Field 'toKodes' harus array string" });
    }
    const codes = [...new Set((toKodes as string[]).map((t) => t.trim().toUpperCase()).filter(Boolean))];
    if (codes.length > 0) {
      const found = await prisma.statusBarang.findMany({ where: { kode: { in: codes } } });
      const missing = codes.filter((c) => !found.some((f) => f.kode === c));
      if (missing.length > 0) {
        return res.status(400).json({ message: `Status tidak dikenal: ${missing.join(", ")}` });
      }
    }
    const fromExists = await prisma.statusBarang.findUnique({ where: { kode: fromKode } });
    if (!fromExists) return res.status(404).json({ message: `Status '${fromKode}' tidak ditemukan` });
    const rows = await setTransitionsForFrom(fromKode, codes);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan transisi status", error });
  }
}

// DELETE /api/status-transition/:fromKode/:toKode
export async function deleteTransitionHandler(req: Request, res: Response) {
  try {
    const fromKode = String(req.params.fromKode ?? "").trim().toUpperCase();
    const toKode = String(req.params.toKode ?? "").trim().toUpperCase();
    await deleteTransition(fromKode, toKode);
    res.status(200).json({ message: "Transisi dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Transisi tidak ditemukan" });
    res.status(500).json({ message: "Gagal menghapus transisi", error });
  }
}
