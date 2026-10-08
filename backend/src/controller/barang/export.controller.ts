import { Request, Response } from "express";
import { listBarang } from "../../model/barang/barang.js";
import type { StatusBarang } from "../../model/barang/barang.js";
import { getValidStatusList, isValidStatus } from "./helpers.js";

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
    const { variantId, batchId, tanpaDus, status, tanggalAwal, tanggalAkhir, pernahRetur, styleId, colorId, sizeId } = req.query;

    if (status && !(await isValidStatus(status))) {
      return res.status(400).json({
        message: `Parameter 'status' tidak valid. Status aktif: ${await getValidStatusList()}`,
      });
    }

    const filter: Parameters<typeof listBarang>[0] = {
      page,
      limit,
      status: status as StatusBarang | undefined,
    };
    if (pernahRetur === "true" || pernahRetur === "1") {
      filter.pernahRetur = true;
    }
    if (tanpaDus === "true" || tanpaDus === "1") {
      filter.tanpaDus = true;
    }

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
    if (styleId !== undefined && styleId !== "") {
      const s = Number(styleId);
      if (Number.isNaN(s)) {
        return res
          .status(400)
          .json({ message: "Parameter 'styleId' harus angka" });
      }
      filter.styleId = s;
    }
    if (colorId !== undefined && colorId !== "") {
      const c = Number(colorId);
      if (Number.isNaN(c)) {
        return res
          .status(400)
          .json({ message: "Parameter 'colorId' harus angka" });
      }
      filter.colorId = c;
    }
    if (sizeId !== undefined && sizeId !== "") {
      const z = Number(sizeId);
      if (Number.isNaN(z)) {
        return res
          .status(400)
          .json({ message: "Parameter 'sizeId' harus angka" });
      }
      filter.sizeId = z;
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
      "pernahRetur",
      "jumlahRetur",
      "tanggalReturTerakhir",
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
          (b as any).pernahRetur ? "YA" : "",
          (b as any).jumlahRetur ?? "",
          (b as any).tanggalReturTerakhir instanceof Date
            ? (b as any).tanggalReturTerakhir.toISOString()
            : ((b as any).tanggalReturTerakhir ?? ""),
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
