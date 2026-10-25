import type { Request, Response } from "express";
import { ArahWipTransfer, StatusWipTransfer } from "../../../generated/prisma/enums.js";
import { getBatasDivisi } from "../../lib/divisiScope.js";
import { parseTanggalBisnis } from "../../lib/tanggalBisnis.js";
import {
  AKSES_DITOLAK,
  approveWipTransfer,
  createWipTransfer,
  deleteWipTransfer,
  DIVISI_TIDAK_DITEMUKAN,
  getWipTransferById,
  getWipTransferOpsi,
  ITEM_TIDAK_DITEMUKAN,
  listWipTransfer,
  TRANSFER_TERKUNCI,
  WipTransferError,
  WipTransferKurangError,
  WIP_TRANSFER_TIDAK_DITEMUKAN,
  type CreateWipTransferInput,
  type WipTransferAccess,
  type WipTransferItemInput,
  type WipTransferListParams,
} from "../../model/wipTransfer/wipTransfer.js";

const parseId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseOptionalId = (value: unknown): number | null | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseArah = (value: unknown): ArahWipTransfer | null => {
  if (typeof value !== "string") return null;
  const arah = value.trim().toUpperCase();
  return arah === ArahWipTransfer.KIRIM || arah === ArahWipTransfer.MINTA
    ? (arah as ArahWipTransfer)
    : null;
};

const parseStatus = (value: unknown): StatusWipTransfer | null => {
  if (typeof value !== "string") return null;
  const status = value.trim().toUpperCase();
  return status === StatusWipTransfer.MENUNGGU ||
    status === StatusWipTransfer.DISETUJUI ||
    status === StatusWipTransfer.DITOLAK
    ? (status as StatusWipTransfer)
    : null;
};

const parseRentang = (
  query: Record<string, unknown>,
): { dari?: Date; sampai?: Date } | { error: string } => {
  const out: { dari?: Date; sampai?: Date } = {};
  if (query.dari !== undefined && query.dari !== "") {
    const dari = parseTanggalBisnis(query.dari);
    if (!dari) return { error: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" };
    out.dari = dari;
  }
  if (query.sampai !== undefined && query.sampai !== "") {
    const sampai = parseTanggalBisnis(query.sampai);
    if (!sampai) return { error: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" };
    out.sampai = sampai;
  }
  if (out.dari && out.sampai && out.dari.getTime() > out.sampai.getTime()) {
    return { error: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai" };
  }
  return out;
};

const parseItems = (value: unknown): WipTransferItemInput[] | { error: string } => {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Minimal satu item transfer wajib diisi" };
  }
  const items: WipTransferItemInput[] = [];
  for (const raw of value) {
    const row = (raw ?? {}) as { itemId?: unknown; jumlah?: unknown };
    const itemId = parseId(row.itemId);
    const jumlah = Number(row.jumlah);
    if (!itemId) return { error: "Field 'items[].itemId' harus angka bulat positif" };
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      return { error: "Field 'items[].jumlah' harus bilangan bulat positif" };
    }
    items.push({ itemId, jumlah });
  }
  return items;
};

const accessFromRequest = (req: Request): WipTransferAccess => {
  const batas = getBatasDivisi(req.access);
  return {
    userId: req.user!.id,
    admin: batas.admin,
    divisiId: batas.divisiId,
  };
};

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof WipTransferKurangError) {
    return res.status(409).json({
      message: error.message,
      kode: error.code,
      dataKekurangan: error.dataKekurangan,
    });
  }
  if (error instanceof WipTransferError) {
    const status =
      error.code === WIP_TRANSFER_TIDAK_DITEMUKAN ||
      error.code === DIVISI_TIDAK_DITEMUKAN ||
      error.code === ITEM_TIDAK_DITEMUKAN
        ? 404
        : error.code === AKSES_DITOLAK
          ? 403
          : error.code === TRANSFER_TERKUNCI
            ? 409
            : 400;
    return res.status(status).json({ message: error.message, kode: error.code });
  }
  return res.status(500).json({ message: fallback, error });
};

// POST /api/wip-transfer
export async function createWipTransferHandler(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const arah = body.arah === undefined ? undefined : parseArah(body.arah);
    if (body.arah !== undefined && !arah) {
      return res.status(400).json({ message: "Field 'arah' harus KIRIM atau MINTA" });
    }
    const tanggal =
      body.tanggal === undefined || body.tanggal === null || body.tanggal === ""
        ? null
        : parseTanggalBisnis(body.tanggal);
    if (body.tanggal && !tanggal) {
      return res.status(400).json({ message: "Field 'tanggal' harus tanggal valid (YYYY-MM-DD)" });
    }
    const items = parseItems(body.items);
    if ("error" in items) return res.status(400).json({ message: items.error });

    const input: CreateWipTransferInput = {
      ...(tanggal ? { tanggal } : {}),
      ...(arah ? { arah } : {}),
      divisiAsalId: parseOptionalId(body.divisiAsalId) ?? null,
      divisiTujuanId: parseOptionalId(body.divisiTujuanId) ?? null,
      keterangan: typeof body.keterangan === "string" ? body.keterangan : null,
      items,
    };
    const row = await createWipTransfer(input, accessFromRequest(req));
    return res.status(201).json(row);
  } catch (error) {
    return handleError(res, error, "Gagal membuat transfer WIP");
  }
}

// GET /api/wip-transfer
export async function listWipTransferHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
    const params: WipTransferListParams = { page, limit };

    if (req.query.arah !== undefined && req.query.arah !== "") {
      const arah = parseArah(req.query.arah);
      if (!arah) return res.status(400).json({ message: "Query 'arah' harus KIRIM atau MINTA" });
      params.arah = arah;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      const status = parseStatus(req.query.status);
      if (!status) return res.status(400).json({ message: "Query 'status' tidak valid" });
      params.status = status;
    }
    const rentang = parseRentang(req.query as Record<string, unknown>);
    if ("error" in rentang) return res.status(400).json({ message: rentang.error });
    if (rentang.dari) params.dari = rentang.dari;
    if (rentang.sampai) params.sampai = rentang.sampai;

    for (const [key, field] of [
      ["divisiAsalId", "divisiAsalId"],
      ["divisiTujuanId", "divisiTujuanId"],
    ] as const) {
      if (req.query[key] !== undefined && req.query[key] !== "") {
        const id = parseId(req.query[key]);
        if (!id) return res.status(400).json({ message: `Query '${key}' harus angka bulat positif` });
        params[field] = id;
      }
    }

    const result = await listWipTransfer(params, accessFromRequest(req));
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, "Gagal mengambil data transfer WIP");
  }
}

// GET /api/wip-transfer/opsi
export async function getWipTransferOpsiHandler(req: Request, res: Response) {
  try {
    const arah = parseArah(req.query.arah);
    if (!arah) return res.status(400).json({ message: "Query 'arah' wajib diisi KIRIM atau MINTA" });
    const divisiAsalId = parseOptionalId(req.query.divisiAsalId);
    if (divisiAsalId === null) {
      return res.status(400).json({ message: "Query 'divisiAsalId' harus angka bulat positif" });
    }
    const itemId = parseOptionalId(req.query.itemId);
    if (itemId === null) {
      return res.status(400).json({ message: "Query 'itemId' harus angka bulat positif" });
    }
    const data = await getWipTransferOpsi(
      { arah, divisiAsalId, itemId },
      accessFromRequest(req),
    );
    return res.status(200).json({ data });
  } catch (error) {
    return handleError(res, error, "Gagal mengambil opsi transfer WIP");
  }
}

// GET /api/wip-transfer/:id
export async function getWipTransferHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getWipTransferById(id, accessFromRequest(req));
    if (!row) return res.status(404).json({ message: "Transfer WIP tidak ditemukan" });
    return res.status(200).json(row);
  } catch (error) {
    return handleError(res, error, "Gagal mengambil transfer WIP");
  }
}

// PATCH /api/wip-transfer/:id/approval
export async function approveWipTransferHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const body = (req.body ?? {}) as { status?: unknown; items?: unknown };
    const status = parseStatus(body.status);
    if (!status || status === StatusWipTransfer.MENUNGGU) {
      return res.status(400).json({ message: "Field 'status' harus DISETUJUI atau DITOLAK" });
    }
    const items: Array<{ id: number; jumlahDisetujui: number }> = [];
    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) return res.status(400).json({ message: "Field 'items' harus array" });
      for (const raw of body.items) {
        const row = (raw ?? {}) as { id?: unknown; jumlahDisetujui?: unknown };
        const itemId = parseId(row.id);
        const jumlah = Number(row.jumlahDisetujui);
        if (!itemId) return res.status(400).json({ message: "Field 'items[].id' tidak valid" });
        if (!Number.isInteger(jumlah) || jumlah < 0) {
          return res.status(400).json({ message: "Field 'items[].jumlahDisetujui' harus bilangan bulat >= 0" });
        }
        items.push({ id: itemId, jumlahDisetujui: jumlah });
      }
    }
    const row = await approveWipTransfer(
      id,
      { status, items },
      accessFromRequest(req),
    );
    return res.status(200).json(row);
  } catch (error) {
    return handleError(res, error, "Gagal memproses approval transfer WIP");
  }
}

// DELETE /api/wip-transfer/:id
export async function deleteWipTransferHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await deleteWipTransfer(id, accessFromRequest(req));
    return res.status(200).json(row);
  } catch (error) {
    return handleError(res, error, "Gagal menghapus transfer WIP");
  }
}
