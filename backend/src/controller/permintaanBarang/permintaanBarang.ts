import type { Request, Response } from "express";
import {
  DivisiApprovalError,
  DivisiPemintaError,
  ItemDivisiError,
  ItemTanpaMasterError,
  ItemSmGunakanWipError,
  KeputusanItemError,
  PemakaianDipakaiProduksiError,
  PemakaianSudahTransferError,
  PermintaanOtomatisError,
  PermintaanTerkunciError,
  createPermintaan,
  deletePermintaan,
  getPermintaanById,
  listPermintaan,
  petakanItemMaster,
  setApproval,
  updatePermintaan,
  type ApprovalPermintaan,
  type KeputusanItemInput,
  type PermintaanInput,
} from "../../model/permintaanBarang/permintaanBarang.js";
import { getItemById } from "../../model/item/item.js";
import { getBatasDivisi } from "../../lib/divisiScope.js";
import type { SumberPermintaanBarang } from "../../../generated/prisma/enums.js";

const KEBUTUHAN_UNTUK = ["Produksi", "Maintenance", "Proyek","Lainya"] as const;
const PRIORITAS = ["Normal", "Urgent", "Sangat Urgent"] as const;
const APPROVAL = ["BELUM_DISETUJUI", "DISETUJUI"] as const;
const SUMBER = ["MANUAL", "HASIL_PRODUKSI"] as const;

type ParseResult = PermintaanInput | { error: string };
type ItemParseResult = PermintaanInput["items"][number] | { error: string };
type EnumParse<T extends string> = { ok: T } | { error: string };

function errCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

function parseTanggal(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): EnumParse<T> {
  if (value === undefined || value === null || value === "") {
    if (fallback === null) {
      return { error: `Nilai wajib diisi, harus salah satu dari: ${allowed.join(", ")}` };
    }
    return { ok: fallback };
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { error: `Nilai '${String(value)}' tidak valid, harus salah satu dari: ${allowed.join(", ")}` };
  }
  return { ok: value as T };
}

async function parseBody(body: unknown): Promise<ParseResult> {
  const { tanggal, departemen, namaPeminta, kebutuhanUntuk, prioritas, tanggalDibutuhkan, alasan, items } =
    (body ?? {}) as Record<string, unknown>;

  const tanggalDate = parseTanggal(tanggal);
  if (!tanggalDate) return { error: "Field 'tanggal' wajib diisi dan harus tanggal valid" };

  if (typeof departemen !== "string" || !departemen.trim()) {
    return { error: "Field 'departemen' wajib diisi" };
  }
  if (typeof namaPeminta !== "string" || !namaPeminta.trim()) {
    return { error: "Field 'namaPeminta' wajib diisi" };
  }
  if (typeof alasan !== "string" || !alasan.trim()) {
    return { error: "Field 'alasan' wajib diisi" };
  }

  const kebutuhan = parseEnum(kebutuhanUntuk, KEBUTUHAN_UNTUK, "Produksi");
  if ("error" in kebutuhan) return kebutuhan;
  const prio = parseEnum(prioritas, PRIORITAS, "Normal");
  if ("error" in prio) return prio;

  if (tanggalDibutuhkan !== undefined && tanggalDibutuhkan !== null && tanggalDibutuhkan !== "") {
    if (!parseTanggal(tanggalDibutuhkan)) return { error: "Field 'tanggalDibutuhkan' harus tanggal valid" };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Field 'items' wajib diisi minimal 1 barang" };
  }

  const parsedItems: ItemParseResult[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = ((items[index] ?? {}) as Record<string, unknown>);

    let itemId: number | null = null;
    let master: { nama: string; unit: string } | null = null;
    if (item.itemId !== undefined && item.itemId !== null && item.itemId !== "") {
      const parsed = Number(item.itemId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { error: `items[${index}].itemId harus angka bulat lebih dari 0` };
      }
      const row = await getItemById(parsed);
      if (!row) return { error: `items[${index}].itemId tidak dikenal` };
      itemId = parsed;
      master = { nama: row.nama, unit: row.unit };
    }

    // Snapshot: nama/satuan eksplisit menang; bila kosong dan item dipilih,
    // pakai nilai master saat ini (tidak ikut berubah bila master diedit).
    const namaRaw = typeof item.nama === "string" ? item.nama.trim() : "";
    const nama = namaRaw || master?.nama || "";
    if (!nama) return { error: `items[${index}].nama wajib diisi` };
    const jumlah = Number(item.jumlah);
    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      return { error: `items[${index}].jumlah harus angka bulat lebih dari 0` };
    }
    const satuanRaw = parseOptionalString(item.satuan);
    parsedItems.push({
      itemId,
      nama,
      spesifikasi: parseOptionalString(item.spesifikasi),
      jumlah,
      satuan: satuanRaw ?? master?.unit ?? null,
    });
  }

  return {
    tanggal: tanggalDate,
    departemen: departemen.trim(),
    namaPeminta: namaPeminta.trim(),
    kebutuhanUntuk: kebutuhan.ok,
    prioritas: prio.ok,
    tanggalDibutuhkan: tanggalDibutuhkan ? parseTanggal(tanggalDibutuhkan) : null,
    alasan: alasan.trim(),
    items: parsedItems as PermintaanInput["items"],
  };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOptionalIdQuery(value: unknown, name: string): { value?: number } | { error: string } {
  if (value === undefined || value === "") return {};
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: `Query '${name}' harus angka bulat positif` };
  }
  return { value: id };
}

// GET /api/permintaan-barang
export async function listPermintaanHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    let approval: ApprovalPermintaan | undefined;
    if (req.query.approval !== undefined && req.query.approval !== "") {
      const parsed = parseEnum(req.query.approval, APPROVAL, null);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      approval = parsed.ok;
    }
    let dari: Date | undefined;
    if (req.query.dari !== undefined && req.query.dari !== "") {
      const parsed = parseTanggal(req.query.dari);
      if (!parsed) return res.status(400).json({ message: "Query 'dari' harus tanggal valid (YYYY-MM-DD)" });
      dari = parsed;
    }
    let sampai: Date | undefined;
    if (req.query.sampai !== undefined && req.query.sampai !== "") {
      const parsed = parseTanggal(req.query.sampai);
      if (!parsed) return res.status(400).json({ message: "Query 'sampai' harus tanggal valid (YYYY-MM-DD)" });
      sampai = parsed;
    }
    const peminta = parseOptionalIdQuery(req.query.divisiPemintaId, "divisiPemintaId");
    if ("error" in peminta) return res.status(400).json({ message: peminta.error });
    const approver = parseOptionalIdQuery(req.query.divisiApproverId, "divisiApproverId");
    if ("error" in approver) return res.status(400).json({ message: approver.error });
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (approver.value !== undefined && approver.value !== batas.divisiId) {
        return res.status(403).json({ message: "Anda hanya dapat melihat permintaan divisi sendiri" });
      }
    }
    const divisiApproverId = batas.admin ? approver.value : (batas.divisiId ?? undefined);
    let sumber: SumberPermintaanBarang | undefined;
    if (req.query.sumber !== undefined && req.query.sumber !== "") {
      const parsed = parseEnum(req.query.sumber, SUMBER, null);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      sumber = parsed.ok;
    }
    const result = await listPermintaan({
      page,
      limit,
      approval,
      dari,
      sampai,
      divisiPemintaId: peminta.value,
      divisiApproverId,
      sumber,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data permintaan barang", error });
  }
}

// GET /api/permintaan-barang/:id
export async function getPermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const row = await getPermintaanById(id);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    const batas = getBatasDivisi(req.access);
    if (!batas.admin) {
      if (!batas.divisiId) return res.status(403).json({ message: "Akun belum terhubung ke divisi" });
      if (row.divisiApproverId !== batas.divisiId) {
        return res.status(404).json({ message: "Permintaan tidak ditemukan" });
      }
    }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data permintaan barang", error });
  }
}

// POST /api/permintaan-barang
export async function createPermintaanHandler(req: Request, res: Response) {
  try {
    const parsed = await parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await createPermintaan(parsed);
    res.status(201).json(row);
  } catch (error) {
    if (error instanceof ItemSmGunakanWipError) {
      return res.status(409).json({ message: error.message, kode: error.code, items: error.items });
    }
    res.status(500).json({ message: "Gagal menyimpan permintaan barang", error });
  }
}

// PUT /api/permintaan-barang/:id
export async function updatePermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const parsed = await parseBody(req.body);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });
    const row = await updatePermintaan(id, parsed);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    if (error instanceof PermintaanTerkunciError || error instanceof PermintaanOtomatisError) {
      return res.status(409).json({ message: error.message, kode: error.code });
    }
    if (error instanceof ItemSmGunakanWipError) {
      return res.status(409).json({ message: error.message, kode: error.code, items: error.items });
    }
    if (errCode(error) === "P2025") {
      return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal memperbarui permintaan barang", error });
  }
}

// PATCH /api/permintaan-barang/:id/approval
// Body: { approval, items?: [{ id, jumlahDisetujui }] }. Item yang tidak disebut
// default ke min(jumlah diminta, stok). jumlahDisetujui 0 berarti item ditolak.
export async function setApprovalHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { approval, items } = (req.body ?? {}) as { approval?: unknown; items?: unknown };
    const parsed = parseEnum(approval, APPROVAL, null);
    if ("error" in parsed) return res.status(400).json({ message: parsed.error });

    const keputusan: KeputusanItemInput[] = [];
    if (items !== undefined) {
      if (!Array.isArray(items)) return res.status(400).json({ message: "Field 'items' harus array" });
      for (const raw of items) {
        const row = (raw ?? {}) as { id?: unknown; jumlahDisetujui?: unknown };
        const itemId = Number(row.id);
        const jumlah = Number(row.jumlahDisetujui);
        if (!Number.isInteger(itemId) || itemId <= 0) {
          return res.status(400).json({ message: "items[].id harus angka bulat positif" });
        }
        if (!Number.isInteger(jumlah) || jumlah < 0) {
          return res.status(400).json({ message: "items[].jumlahDisetujui harus bilangan bulat >= 0" });
        }
        keputusan.push({ id: itemId, jumlahDisetujui: jumlah });
      }
    }

    const userId = req.user?.id ?? null;
    const row = await setApproval(id, parsed.ok, keputusan, userId);
    if (!row) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json(row);
  } catch (error) {
    if (error instanceof ItemTanpaMasterError) {
      return res.status(422).json({ message: error.message, itemIds: error.itemIds });
    }
    if (error instanceof KeputusanItemError) {
      return res.status(422).json({ message: error.message });
    }
    if (error instanceof DivisiApprovalError) {
      return res.status(403).json({ message: error.message, kode: error.code });
    }
    if (
      error instanceof ItemDivisiError ||
      error instanceof ItemSmGunakanWipError ||
      error instanceof DivisiPemintaError ||
      error instanceof PemakaianDipakaiProduksiError ||
      error instanceof PemakaianSudahTransferError ||
      error instanceof PermintaanTerkunciError
    ) {
      return res.status(409).json({ message: error.message, kode: error.code });
    }
    res.status(500).json({ message: "Gagal memperbarui status approval", error });
  }
}

// PATCH /api/permintaan-barang/:id/items/:barangItemId  body: { itemId }
export async function petakanItemHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const barangItemId = parseId(req.params.barangItemId);
    if (!id || !barangItemId) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const { itemId } = (req.body ?? {}) as { itemId?: unknown };
    const masterId = Number(itemId);
    if (!Number.isInteger(masterId) || masterId <= 0) {
      return res.status(400).json({ message: "Field 'itemId' harus angka bulat positif" });
    }
    const row = await petakanItemMaster(id, barangItemId, masterId);
    if (!row) return res.status(404).json({ message: "Permintaan atau baris item tidak ditemukan" });
    if ("error" in (row as object) && (row as { error?: string }).error === "NOT_FOUND_MASTER") {
      return res.status(404).json({ message: "Item master tidak ditemukan" });
    }
    res.status(200).json(row);
  } catch (error) {
    if (
      error instanceof PermintaanTerkunciError ||
      error instanceof PermintaanOtomatisError ||
      error instanceof ItemSmGunakanWipError ||
      error instanceof ItemDivisiError
    ) {
      return res.status(409).json({ message: error.message, kode: error.code, ...(error instanceof ItemSmGunakanWipError ? { items: error.items } : {}) });
    }
    res.status(500).json({ message: "Gagal memetakan item ke master", error });
  }
}

// DELETE /api/permintaan-barang/:id
export async function deletePermintaanHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const deleted = await deletePermintaan(id);
    if (!deleted) return res.status(404).json({ message: "Permintaan tidak ditemukan" });
    res.status(200).json({ message: "Permintaan berhasil dihapus" });
  } catch (error) {
    if (error instanceof PermintaanTerkunciError) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Gagal menghapus permintaan barang", error });
  }
}
