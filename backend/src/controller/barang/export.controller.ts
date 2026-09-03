import { Request, Response } from "express";
import { listBarang } from "../../model/barang/barang.js";
import type { StatusBarang } from "../../model/barang/barang.js";
import { isValidStatus } from "./helpers.js";

function toStartOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}
function toEndOfDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(23, 59, 59, 999);
  return c;
}

export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportBarangHandler(req: Request, res: Response) {
  try {
    const format = (
      typeof req.query.format === "string" ? req.query.format : "json"
    ).toLowerCase();
    if (format !== "json" && format !== "csv") {
      return res
        .status(400)
        .json({ message: "Parameter 'format' harus 'json' atau 'csv'" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      10000,
      Math.max(1, Number(req.query.limit) || 10000),
    );
    const { variantId, batchId, status, tanggalAwal, tanggalAkhir } = req.query;

    if (status && !isValidStatus(status)) {
      return res.status(400).json({
        message:
          "Parameter 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      });
    }

    const filter: Parameters<typeof listBarang>[0] = {
      page,
      limit,
      status: status as StatusBarang | undefined,
    };

    if (variantId !== undefined) {
      const v = Number(variantId);
      if (Number.isNaN(v)) {
        return res
          .status(400)
          .json({ message: "Parameter 'variantId' harus angka" });
      }
      filter.variantId = v;
    }
    if (batchId !== undefined) {
      const b = Number(batchId);
      if (Number.isNaN(b)) {
        return res
          .status(400)
          .json({ message: "Parameter 'batchId' harus angka" });
      }
      filter.batchId = b;
    }
    if (tanggalAwal) {
      const t = new Date(tanggalAwal as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAwal = toStartOfDay(t);
    }
    if (tanggalAkhir) {
      const t = new Date(tanggalAkhir as string);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({
          message: "Parameter 'tanggalAkhir' harus tanggal valid (YYYY-MM-DD)",
        });
      }
      filter.tanggalAkhir = toEndOfDay(t);
    }
    if (filter.tanggalAwal && filter.tanggalAkhir && filter.tanggalAwal.getTime() > filter.tanggalAkhir.getTime()) {
      return res.status(400).json({
        message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'",
      });
    }

    const result = await listBarang(filter);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="barang-export-${Date.now()}.json"`,
      );
      res.status(200).json(result);
      return;
    }

    const headers = [
      "id",
      "kodeBarang",
      "status",
      "tanggal",
      "variantId",
      "kodeVariant",
      "product",
      "style",
      "color",
      "size",
      "batchId",
      "nomorBatch",
    ];

    const lines: string[] = [headers.join(",")];
    for (const b of result.data) {
      const v = (b as any).variant;
      const batch = (b as any).batch;
      lines.push(
        [
          (b as any).id,
          (b as any).kodeBarang,
          (b as any).status,
          (b as any).tanggal instanceof Date
            ? (b as any).tanggal.toISOString()
            : (b as any).tanggal,
          v?.id,
          v?.kodeVariant,
          v?.product?.nama,
          v?.style?.nama,
          v?.color?.nama,
          v?.size?.nama,
          batch?.id,
          batch?.nomorBatch
            ? `BC${String(batch.nomorBatch).padStart(3, "0")}`
            : "",
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="barang-export-${Date.now()}.csv"`,
    );
    res.status(200).send(lines.join("\n"));
  } catch (error) {
    res.status(500).json({ message: "Gagal export barang", error });
  }
}
