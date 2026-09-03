import { Request, Response } from "express";
import {
  createBarang,
  updateBarang,
  deleteBarang,
} from "../../model/barang/barang.js";
import { broadcast } from "../../websocket/socket.js";
import { errorMessage, errorStatus, isValidStatus } from "./helpers.js";

// =============================================
// POST /api/barang - Create single barang
// Body: { variantId, batchId?, kodeBarang?, tanggal?, status?, keterangan? }
// - Jika kodeBarang tidak diisi -> auto-generate BCxxx-variant-DDMMYY-xxxx
// - Jika batchId tidak diisi -> pakai batch AKTIF / buat baru
// =============================================
export async function createBarangHandler(req: Request, res: Response) {
  try {
    const { variantId, batchId, kodeBarang, tanggal, status, keterangan } =
      req.body;

    if (variantId === undefined || Number.isNaN(Number(variantId))) {
      return res.status(400).json({
        message: "Field 'variantId' wajib diisi dan berupa angka",
      });
    }

    if (batchId !== undefined && batchId !== null && Number.isNaN(Number(batchId))) {
      return res.status(400).json({ message: "Field 'batchId' harus angka" });
    }

    if (status !== undefined && !isValidStatus(status)) {
      return res.status(400).json({
        message:
          "Field 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    let tanggalDate: Date | undefined;
    if (tanggal) {
      tanggalDate = new Date(tanggal);
      if (Number.isNaN(tanggalDate.getTime())) {
        return res.status(400).json({
          message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD atau ISO)",
        });
      }
    }

    if (kodeBarang !== undefined && typeof kodeBarang !== "string") {
      return res.status(400).json({ message: "Field 'kodeBarang' harus string" });
    }

    const barang = await createBarang({
      variantId: Number(variantId),
      batchId: batchId !== undefined && batchId !== null ? Number(batchId) : batchId as null | undefined,
      kodeBarang: typeof kodeBarang === "string" && kodeBarang.trim().length > 0 ? kodeBarang.trim() : undefined,
      tanggal: tanggalDate,
      status,
      keterangan: typeof keterangan === "string" ? keterangan : undefined,
    });

    await broadcast({
      type: "barang.created",
      message: `Barang ${barang.kodeBarang} berhasil dibuat`,
      data: barang,
    });

    res.status(201).json(barang);
  } catch (error) {
    const message = errorMessage(error, "Gagal membuat barang");
    const statusCode = errorStatus(message);
    // Map duplicate unique (P2002) handled via message check in errorStatus fallback 500 -> override
    if (message.includes("sudah ada")) {
      return res.status(409).json({ message });
    }
    res.status(statusCode === 500 && message.includes("tidak ditemukan") ? 404 : statusCode).json({ message });
  }
}

// =============================================
// PUT /api/barang/:id - Update barang
// Body: { variantId?, batchId?, kodeBarang?, tanggal?, status?, keterangan? }
// - Minimal satu field harus diisi
// - status divalidasi dengan VALID_TRANSITIONS
// =============================================
export async function updateBarangHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    const { variantId, batchId, kodeBarang, tanggal, status, keterangan } =
      req.body;

    if (
      variantId === undefined &&
      batchId === undefined &&
      kodeBarang === undefined &&
      tanggal === undefined &&
      status === undefined
    ) {
      return res.status(400).json({
        message:
          "Minimal satu field harus diisi: variantId, batchId, kodeBarang, tanggal, status",
      });
    }

    if (variantId !== undefined && Number.isNaN(Number(variantId))) {
      return res.status(400).json({ message: "Field 'variantId' harus angka" });
    }
    if (batchId !== undefined && batchId !== null && Number.isNaN(Number(batchId))) {
      return res.status(400).json({ message: "Field 'batchId' harus angka atau null" });
    }
    if (kodeBarang !== undefined && typeof kodeBarang !== "string") {
      return res.status(400).json({ message: "Field 'kodeBarang' harus string" });
    }
    if (status !== undefined && !isValidStatus(status)) {
      return res.status(400).json({
        message:
          "Field 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    let tanggalDate: Date | undefined;
    if (tanggal !== undefined) {
      if (tanggal === null) {
        // allow clearing? keep undefined to skip; but explicitly allow null -> remove tanggal
        tanggalDate = undefined;
      } else {
        tanggalDate = new Date(tanggal);
        if (Number.isNaN(tanggalDate.getTime())) {
          return res.status(400).json({
            message: "Field 'tanggal' harus tanggal valid",
          });
        }
      }
    }

    const updated = await updateBarang(id, {
      variantId: variantId !== undefined ? Number(variantId) : undefined,
      batchId: batchId as number | null | undefined,
      kodeBarang: typeof kodeBarang === "string" ? kodeBarang.trim() : undefined,
      tanggal: tanggalDate,
      status,
      keterangan: typeof keterangan === "string" ? keterangan : undefined,
    });

    await broadcast({
      type: "barang.updated",
      message: `Barang ${updated.kodeBarang} berhasil diperbarui`,
      data: updated,
    });

    res.status(200).json(updated);
  } catch (error) {
    const message = errorMessage(error, "Gagal update barang");
    if (message.includes("sudah ada")) {
      return res.status(409).json({ message });
    }
    if (message.includes("Tidak ada field")) {
      return res.status(400).json({ message });
    }
    res.status(errorStatus(message)).json({ message });
  }
}

// =============================================
// DELETE /api/barang/:id - Hapus barang
// - Hapus riwayat dulu (Restrict), baru barang
// - Decrement batch.totalProduksi jika ada batchId
// =============================================
export async function deleteBarangHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Parameter 'id' tidak valid" });
    }

    await deleteBarang(id);

    await broadcast({
      type: "barang.deleted",
      message: `Barang ${id} berhasil dihapus`,
      data: { id },
    });

    res.status(200).json({ message: "Barang berhasil dihapus", id });
  } catch (error) {
    const message = errorMessage(error, "Gagal menghapus barang");
    res.status(errorStatus(message)).json({ message });
  }
}
