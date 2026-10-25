import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  ArahWipTransfer,
  StatusWipTransfer,
  SumberPemakaianMaterial,
} from "../../../generated/prisma/enums.js";
import {
  awalHariBisnis,
  tambahHariBisnis,
  tanggalBisnis,
} from "../../lib/tanggalBisnis.js";
import { lockItem } from "../stokItem/stokItem.js";
import {
  ensureDivisionInventoryLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";

export type WipTransferAccess = {
  userId: number;
  admin: boolean;
  divisiId: number | null;
};

export type WipTransferItemInput = {
  itemId: number;
  jumlah: number;
};

export type CreateWipTransferInput = {
  tanggal?: Date | null;
  arah?: ArahWipTransfer;
  divisiAsalId?: number | null;
  divisiTujuanId?: number | null;
  keterangan?: string | null;
  items: WipTransferItemInput[];
};

export type ApprovalWipTransferInput = {
  status: StatusWipTransfer;
  items?: Array<{
    id: number;
    jumlahDisetujui: number;
  }>;
};

export type WipTransferListParams = {
  page: number;
  limit: number;
  arah?: ArahWipTransfer;
  status?: StatusWipTransfer;
  dari?: Date;
  sampai?: Date;
  divisiAsalId?: number;
  divisiTujuanId?: number;
};

export type WipTransferOpsiParams = {
  arah: ArahWipTransfer;
  divisiAsalId?: number;
  itemId?: number;
};

export type WipTransferOpsiItem = {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  divisiAsalId: number;
  divisiAsalNama: string;
  wipTersedia: number;
};

export type WipTransferKekuranganItem = {
  transferItemId?: number;
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  diminta: number;
  tersedia: number;
  kekurangan: number;
};

export type WipTransferKekurangan = {
  divisiAsalId: number;
  items: WipTransferKekuranganItem[];
};

export class WipTransferError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WipTransferError";
    this.code = code;
  }
}

export class WipTransferKurangError extends WipTransferError {
  constructor(readonly dataKekurangan: WipTransferKekurangan) {
    super("WIP_KURANG", "WIP asal tidak cukup untuk transfer.");
    this.name = "WipTransferKurangError";
  }
}

type RoutingStageTransferCheck = {
  divisiId: number;
  inputItemId: number;
  outputItemId: number;
};

export function isAllowedProductionStageTransfer(
  stages: RoutingStageTransferCheck[],
  divisiAsalId: number,
  divisiTujuanId: number,
  itemId: number,
) {
  let isRoutingOutput = false;
  for (const [index, stage] of stages.entries()) {
    if (stage.divisiId !== divisiAsalId || stage.outputItemId !== itemId) continue;
    isRoutingOutput = true;
    const nextStage = stages[index + 1];
    if (
      nextStage?.divisiId === divisiTujuanId &&
      nextStage.inputItemId === itemId
    ) {
      return true;
    }
  }
  return !isRoutingOutput;
}

export const WIP_TRANSFER_TIDAK_DITEMUKAN = "WIP_TRANSFER_TIDAK_DITEMUKAN";
export const DIVISI_TIDAK_DITEMUKAN = "DIVISI_TIDAK_DITEMUKAN";
export const DIVISI_TIDAK_TERHUBUNG = "DIVISI_TIDAK_TERHUBUNG";
export const DIVISI_SAMA = "DIVISI_SAMA";
export const ITEM_TIDAK_DITEMUKAN = "ITEM_TIDAK_DITEMUKAN";
export const ITEM_TIDAK_AKTIF = "ITEM_TIDAK_AKTIF";
export const ITEM_BUKAN_SM = "ITEM_BUKAN_SM";
export const ITEM_DUPLIKAT = "ITEM_DUPLIKAT";
export const JUMLAH_TIDAK_VALID = "JUMLAH_TIDAK_VALID";
export const TANGGAL_TIDAK_VALID = "TANGGAL_TIDAK_VALID";
export const APPROVAL_TIDAK_VALID = "APPROVAL_TIDAK_VALID";
export const STATUS_TIDAK_VALID = "STATUS_TIDAK_VALID";
export const AKSES_DITOLAK = "AKSES_DITOLAK";
export const ARAH_TIDAK_VALID = "ARAH_TIDAK_VALID";
export const TRANSFER_TERKUNCI = "TRANSFER_TERKUNCI";

export const WIP_TRANSFER_INCLUDE = {
  divisiAsal: { select: { id: true, nama: true } },
  divisiTujuan: { select: { id: true, nama: true } },
  user: { select: { id: true, name: true, email: true, role: true } },
  approvedBy: { select: { id: true, name: true, email: true, role: true } },
  pemakaianMaterial: { select: { id: true, nomor: true, tanggal: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      item: {
        select: {
          id: true,
          kode: true,
          nama: true,
          unit: true,
          jenis: true,
          divisiId: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.WipTransferInclude;

export type WipTransferRecord = Prisma.WipTransferGetPayload<{
  include: typeof WIP_TRANSFER_INCLUDE;
}>;

export type WipTransferDetail = Omit<WipTransferRecord, "items"> & {
  items: Array<WipTransferRecord["items"][number] & { wipTersedia: number }>;
};

type TransferItemInfo = {
  id: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number | null;
  isActive: boolean;
};

type NormalizedTransferItem = {
  itemId: number;
  jumlah: number;
  item: TransferItemInfo;
};

type WipLockRow = {
  id: number;
  jumlahSisa: unknown;
};

type AlokasiInput = {
  transferItemId: number;
  pemakaianMaterialItemId: number;
  jumlah: number;
};

const MAKS_PERCOBAAN_NOMOR = 5;
const NO_PREFIX = "TW-";

function textOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function tanggalPrefix(date: Date): string {
  return `${NO_PREFIX}${tanggalBisnis(date).replace(/-/g, "")}-`;
}

async function generateNomor(
  tx: PrismaTransactionClient,
  date: Date,
): Promise<string> {
  const prefix = tanggalPrefix(date);
  const terakhir = await tx.wipTransfer.findFirst({
    where: { nomor: { startsWith: prefix } },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });
  const urut = terakhir ? Number(terakhir.nomor.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(urut).padStart(4, "0")}`;
}

function isArahValid(value: unknown): value is ArahWipTransfer {
  return (
    value === ArahWipTransfer.KIRIM || value === ArahWipTransfer.MINTA
  );
}

function idPositif(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function resolveArahDanDivisi(
  input: CreateWipTransferInput,
  access: WipTransferAccess,
): {
  arah: ArahWipTransfer;
  divisiAsalId: number;
  divisiTujuanId: number;
} {
  if (input.arah !== undefined && !isArahValid(input.arah)) {
    throw new WipTransferError(
      ARAH_TIDAK_VALID,
      "Arah transfer harus KIRIM atau MINTA.",
    );
  }

  const asalInput = input.divisiAsalId ?? null;
  const tujuanInput = input.divisiTujuanId ?? null;

  if (access.admin) {
    const divisiAsalId = asalInput ?? access.divisiId;
    if (!idPositif(divisiAsalId)) {
      throw new WipTransferError(
        DIVISI_TIDAK_DITEMUKAN,
        "Divisi asal wajib diisi untuk admin.",
      );
    }
    if (!idPositif(tujuanInput)) {
      throw new WipTransferError(
        DIVISI_TIDAK_DITEMUKAN,
        "Divisi tujuan wajib diisi untuk admin.",
      );
    }
    return {
      arah: input.arah ?? ArahWipTransfer.KIRIM,
      divisiAsalId,
      divisiTujuanId: tujuanInput,
    };
  }

  if (!access.divisiId) {
    throw new WipTransferError(
      DIVISI_TIDAK_TERHUBUNG,
      "Akun belum terhubung ke divisi.",
    );
  }
  const aktorDivisiId = access.divisiId;
  const arah =
    input.arah ??
    (asalInput !== null && asalInput !== aktorDivisiId
      ? ArahWipTransfer.MINTA
      : ArahWipTransfer.KIRIM);

  if (arah === ArahWipTransfer.KIRIM) {
    if (asalInput !== null && asalInput !== aktorDivisiId) {
      throw new WipTransferError(
        AKSES_DITOLAK,
        "Anda hanya boleh membuat transfer kirim dari divisi sendiri.",
      );
    }
    if (!idPositif(tujuanInput)) {
      throw new WipTransferError(
        DIVISI_TIDAK_DITEMUKAN,
        "Divisi tujuan wajib diisi.",
      );
    }
    return {
      arah,
      divisiAsalId: aktorDivisiId,
      divisiTujuanId: tujuanInput,
    };
  }

  if (!idPositif(asalInput)) {
    throw new WipTransferError(
      DIVISI_TIDAK_DITEMUKAN,
      "Divisi asal wajib diisi untuk permintaan WIP.",
    );
  }
  if (tujuanInput !== null && tujuanInput !== aktorDivisiId) {
    throw new WipTransferError(
      AKSES_DITOLAK,
      "Anda hanya boleh membuat permintaan WIP untuk divisi sendiri.",
    );
  }
  return {
    arah,
    divisiAsalId: asalInput,
    divisiTujuanId: aktorDivisiId,
  };
}

async function pastikanDivisiAda(
  tx: PrismaTransactionClient,
  divisiIds: number[],
): Promise<void> {
  const rows = await tx.divisi.findMany({
    where: { id: { in: [...new Set(divisiIds)] } },
    select: { id: true },
  });
  if (rows.length !== new Set(divisiIds).size) {
    throw new WipTransferError(
      DIVISI_TIDAK_DITEMUKAN,
      "Divisi asal atau tujuan tidak ditemukan.",
    );
  }
}

async function validateItems(
  tx: PrismaTransactionClient,
  items: WipTransferItemInput[],
): Promise<NormalizedTransferItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new WipTransferError(
      JUMLAH_TIDAK_VALID,
      "Minimal satu item transfer wajib diisi.",
    );
  }

  const seen = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
      throw new WipTransferError(
        ITEM_TIDAK_DITEMUKAN,
        "Item transfer tidak valid.",
      );
    }
    if (seen.has(item.itemId)) {
      throw new WipTransferError(
        ITEM_DUPLIKAT,
        "Item transfer tidak boleh duplikat.",
      );
    }
    seen.add(item.itemId);
    if (!Number.isInteger(item.jumlah) || item.jumlah <= 0) {
      throw new WipTransferError(
        JUMLAH_TIDAK_VALID,
        "Jumlah transfer harus bilangan bulat lebih dari 0.",
      );
    }
  }

  const itemIds = [...seen];
  const rows = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      kode: true,
      nama: true,
      unit: true,
      jenis: true,
      divisiId: true,
      isActive: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return items.map((line) => {
    const item = byId.get(line.itemId);
    if (!item) {
      throw new WipTransferError(
        ITEM_TIDAK_DITEMUKAN,
        `Item id ${line.itemId} tidak ditemukan.`,
      );
    }
    if (!item.isActive) {
      throw new WipTransferError(
        ITEM_TIDAK_AKTIF,
        `Item "${item.nama}" tidak aktif.`,
      );
    }
    if (item.jenis !== "SM") {
      throw new WipTransferError(
        ITEM_BUKAN_SM,
        `Item "${item.nama}" bukan jenis SM.`,
      );
    }
    return { itemId: line.itemId, jumlah: line.jumlah, item };
  });
}

async function getWipTersedia(
  db: PrismaTransactionClient | typeof prisma,
  divisiId: number,
  itemIds: number[],
): Promise<Map<number, number>> {
  const uniq = [...new Set(itemIds)];
  if (uniq.length === 0) return new Map();

  const rows = await db.pemakaianMaterialItem.findMany({
    where: {
      itemId: { in: uniq },
      pemakaian: { divisiId },
    },
    select: { itemId: true, jumlahSisa: true },
  });

  const out = new Map<number, number>();
  for (const row of rows) {
    if (row.itemId === null) continue;
    out.set(
      row.itemId,
      (out.get(row.itemId) ?? 0) + (Number(row.jumlahSisa) || 0),
    );
  }
  return out;
}

async function pastikanWipCukup(
  db: PrismaTransactionClient | typeof prisma,
  divisiAsalId: number,
  items: NormalizedTransferItem[],
): Promise<void> {
  const tersedia = await getWipTersedia(
    db,
    divisiAsalId,
    items.map((item) => item.itemId),
  );
  const kekurangan = items.flatMap((item) => {
    const ada = tersedia.get(item.itemId) ?? 0;
    const kurang = item.jumlah - ada;
    if (kurang <= 0) return [];
    return [
      {
        itemId: item.itemId,
        kode: item.item.kode,
        nama: item.item.nama,
        unit: item.item.unit,
        diminta: item.jumlah,
        tersedia: ada,
        kekurangan: kurang,
      },
    ];
  });

  if (kekurangan.length > 0) {
    throw new WipTransferKurangError({
      divisiAsalId,
      items: kekurangan,
    });
  }
}

function withWipTersedia(
  row: WipTransferRecord,
  tersedia: Map<number, number>,
): WipTransferDetail {
  return {
    ...row,
    items: row.items.map((item) => ({
      ...item,
      wipTersedia: tersedia.get(item.itemId) ?? 0,
    })),
  };
}

async function detailWithWipTersedia(
  db: PrismaTransactionClient | typeof prisma,
  row: WipTransferRecord,
): Promise<WipTransferDetail> {
  const tersedia = await getWipTersedia(
    db,
    row.divisiAsalId,
    row.items.map((item) => item.itemId),
  );
  return withWipTersedia(row, tersedia);
}

function pastikanBolehLihat(
  row: Pick<WipTransferRecord, "divisiAsalId" | "divisiTujuanId">,
  access: WipTransferAccess,
): void {
  if (access.admin) return;
  if (!access.divisiId) {
    throw new WipTransferError(
      DIVISI_TIDAK_TERHUBUNG,
      "Akun belum terhubung ke divisi.",
    );
  }
  if (
    row.divisiAsalId !== access.divisiId &&
    row.divisiTujuanId !== access.divisiId
  ) {
    throw new WipTransferError(
      AKSES_DITOLAK,
      "Anda tidak berhak melihat transfer WIP ini.",
    );
  }
}

function pastikanBolehApprove(
  row: Pick<WipTransferRecord, "arah" | "divisiAsalId" | "divisiTujuanId">,
  access: WipTransferAccess,
): void {
  if (access.admin) return;
  if (!access.divisiId) {
    throw new WipTransferError(
      DIVISI_TIDAK_TERHUBUNG,
      "Akun belum terhubung ke divisi.",
    );
  }
  const approverDivisiId =
    row.arah === ArahWipTransfer.MINTA
      ? row.divisiAsalId
      : row.divisiTujuanId;
  if (approverDivisiId !== access.divisiId) {
    throw new WipTransferError(
      AKSES_DITOLAK,
      row.arah === ArahWipTransfer.MINTA
        ? "Hanya divisi asal yang boleh menyetujui permintaan WIP ini."
        : "Hanya divisi tujuan yang boleh menyetujui transfer ini.",
    );
  }
}

async function createInTx(
  tx: PrismaTransactionClient,
  input: CreateWipTransferInput,
  access: WipTransferAccess,
): Promise<WipTransferDetail> {
  const { arah, divisiAsalId, divisiTujuanId } = resolveArahDanDivisi(
    input,
    access,
  );
  if (divisiAsalId === divisiTujuanId) {
    throw new WipTransferError(
      DIVISI_SAMA,
      "Divisi asal dan tujuan tidak boleh sama.",
    );
  }

  const tanggal = input.tanggal ?? new Date();
  if (Number.isNaN(tanggal.getTime())) {
    throw new WipTransferError(
      TANGGAL_TIDAK_VALID,
      "Tanggal transfer tidak valid.",
    );
  }

  await pastikanDivisiAda(tx, [divisiAsalId, divisiTujuanId]);
  const items = await validateItems(tx, input.items);
  // Permintaan WIP boleh menunggu produksi sumber; approval tetap wajib cukup.
  if (arah === ArahWipTransfer.KIRIM) {
    await pastikanWipCukup(tx, divisiAsalId, items);
  }

  const nomor = await generateNomor(tx, tanggal);

  const header = await tx.wipTransfer.create({
    data: {
      nomor,
      tanggal,
      divisiAsalId,
      divisiTujuanId,
      arah,
      status: StatusWipTransfer.MENUNGGU,
      userId: access.userId,
      keterangan: textOrNull(input.keterangan),
      items: {
        create: items.map((item) => ({
          itemId: item.itemId,
          jumlah: item.jumlah,
          satuan: item.item.unit,
        })),
      },
    },
    include: WIP_TRANSFER_INCLUDE,
  });

  return detailWithWipTersedia(tx, header);
}

export async function createWipTransfer(
  input: CreateWipTransferInput,
  access: WipTransferAccess,
): Promise<WipTransferDetail> {
  for (let percobaan = 1; percobaan <= MAKS_PERCOBAAN_NOMOR; percobaan++) {
    try {
      return await prisma.$transaction((tx) =>
        createInTx(tx, input, access),
      );
    } catch (error) {
      if (percobaan === MAKS_PERCOBAAN_NOMOR || !isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new Error("Gagal membuat nomor transfer WIP");
}

export async function getWipTransferOpsi(
  params: WipTransferOpsiParams,
  access: WipTransferAccess,
): Promise<WipTransferOpsiItem[]> {
  if (!isArahValid(params.arah)) {
    throw new WipTransferError(
      ARAH_TIDAK_VALID,
      "Arah transfer harus KIRIM atau MINTA.",
    );
  }
  if (!access.admin && !access.divisiId) {
    throw new WipTransferError(
      DIVISI_TIDAK_TERHUBUNG,
      "Akun belum terhubung ke divisi.",
    );
  }
  if (params.divisiAsalId !== undefined && !idPositif(params.divisiAsalId)) {
    throw new WipTransferError(
      DIVISI_TIDAK_DITEMUKAN,
      "Divisi asal tidak valid.",
    );
  }
  if (params.itemId !== undefined && !idPositif(params.itemId)) {
    throw new WipTransferError(
      ITEM_TIDAK_DITEMUKAN,
      "Item tidak valid.",
    );
  }

  if (!access.admin) {
    const divisiId = access.divisiId!;
    if (params.arah === ArahWipTransfer.KIRIM) {
      if (
        params.divisiAsalId !== undefined &&
        params.divisiAsalId !== divisiId
      ) {
        throw new WipTransferError(
          AKSES_DITOLAK,
          "Anda hanya dapat melihat WIP divisi sendiri.",
        );
      }
    } else if (params.divisiAsalId === divisiId) {
      throw new WipTransferError(
        DIVISI_SAMA,
        "Divisi asal dan tujuan tidak boleh sama.",
      );
    }
  }

  const sumberId =
    params.divisiAsalId ??
    (params.arah === ArahWipTransfer.KIRIM ? access.divisiId ?? undefined : undefined);
  const pemakaianWhere: Prisma.PemakaianMaterialWhereInput = {};
  if (params.divisiAsalId !== undefined) {
    pemakaianWhere.divisiId = params.divisiAsalId;
  } else if (!access.admin) {
    pemakaianWhere.divisiId =
      params.arah === ArahWipTransfer.KIRIM
        ? access.divisiId!
        : { not: access.divisiId! };
  }

  const itemWhere: Prisma.ItemWhereInput = {
    jenis: "SM",
    isActive: true,
    ...(params.itemId !== undefined ? { id: params.itemId } : {}),
  };

  const rows = await prisma.pemakaianMaterialItem.findMany({
    where: {
      itemId: { not: null },
      jumlahSisa: { gt: 0 },
      item: { is: itemWhere },
      pemakaian: pemakaianWhere,
    },
    select: {
      itemId: true,
      jumlahSisa: true,
      item: { select: { id: true, kode: true, nama: true, unit: true } },
      pemakaian: {
        select: { divisi: { select: { id: true, nama: true } } },
      },
    },
  });

  const out = new Map<string, WipTransferOpsiItem>();
  for (const row of rows) {
    if (!row.item || row.itemId === null) continue;
    const divisi = row.pemakaian.divisi;
    const key = `${divisi.id}:${row.itemId}`;
    const ada = out.get(key);
    if (ada) {
      ada.wipTersedia += Number(row.jumlahSisa) || 0;
    } else {
      out.set(key, {
        itemId: row.itemId,
        kode: row.item.kode,
        nama: row.item.nama,
        unit: row.item.unit,
        divisiAsalId: divisi.id,
        divisiAsalNama: divisi.nama,
        wipTersedia: Number(row.jumlahSisa) || 0,
      });
    }
  }

  // MINTA boleh diajukan walau WIP asal masih 0; KIRIM tetap hanya item bersaldo.
  if (params.arah === ArahWipTransfer.MINTA && sumberId !== undefined) {
    const [divisi, items] = await Promise.all([
      prisma.divisi.findUnique({
        where: { id: sumberId },
        select: { id: true, nama: true },
      }),
      prisma.item.findMany({
        where: itemWhere,
        select: { id: true, kode: true, nama: true, unit: true },
      }),
    ]);
    if (divisi) {
      for (const item of items) {
        const key = `${divisi.id}:${item.id}`;
        if (!out.has(key)) {
          out.set(key, {
            itemId: item.id,
            kode: item.kode,
            nama: item.nama,
            unit: item.unit,
            divisiAsalId: divisi.id,
            divisiAsalNama: divisi.nama,
            wipTersedia: 0,
          });
        }
      }
    }
  }

  return [...out.values()].sort(
    (a, b) =>
      a.divisiAsalNama.localeCompare(b.divisiAsalNama) ||
      a.nama.localeCompare(b.nama) ||
      a.itemId - b.itemId,
  );
}

export async function listWipTransfer(
  params: WipTransferListParams,
  access: WipTransferAccess,
): Promise<{
  data: WipTransferRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const and: Prisma.WipTransferWhereInput[] = [];

  if (!access.admin) {
    if (!access.divisiId) {
      throw new WipTransferError(
        DIVISI_TIDAK_TERHUBUNG,
        "Akun belum terhubung ke divisi.",
      );
    }
    and.push({
      OR: [
        { divisiAsalId: access.divisiId },
        { divisiTujuanId: access.divisiId },
      ],
    });
  }
  if (params.arah) and.push({ arah: params.arah });
  if (params.status) and.push({ status: params.status });
  if (params.divisiAsalId !== undefined) {
    and.push({ divisiAsalId: params.divisiAsalId });
  }
  if (params.divisiTujuanId !== undefined) {
    and.push({ divisiTujuanId: params.divisiTujuanId });
  }
  if (params.dari) {
    and.push({ tanggal: { gte: awalHariBisnis(params.dari) } });
  }
  if (params.sampai) {
    and.push({ tanggal: { lt: tambahHariBisnis(params.sampai, 1) } });
  }

  const where: Prisma.WipTransferWhereInput = and.length > 0 ? { AND: and } : {};
  const [total, data] = await Promise.all([
    prisma.wipTransfer.count({ where }),
    prisma.wipTransfer.findMany({
      where,
      include: WIP_TRANSFER_INCLUDE,
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);

  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getWipTransferById(
  id: number,
  access: WipTransferAccess,
): Promise<WipTransferDetail | null> {
  const row = await prisma.wipTransfer.findUnique({
    where: { id },
    include: WIP_TRANSFER_INCLUDE,
  });
  if (!row) return null;

  pastikanBolehLihat(row, access);
  return detailWithWipTersedia(prisma, row);
}

function buildApprovalMap(
  items: WipTransferRecord["items"],
  input: ApprovalWipTransferInput,
): Map<number, number> {
  const approved = new Map<number, number>();
  const seen = new Set<number>();

  for (const row of input.items ?? []) {
    if (!Number.isInteger(row.id) || row.id <= 0) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        "ID item approval tidak valid.",
      );
    }
    if (seen.has(row.id)) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        "Item approval tidak boleh duplikat.",
      );
    }
    seen.add(row.id);

    const target = items.find((item) => item.id === row.id);
    if (!target) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        "Item approval bukan bagian dari transfer ini.",
      );
    }
    if (
      !Number.isInteger(row.jumlahDisetujui) ||
      row.jumlahDisetujui < 0
    ) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        "Jumlah disetujui harus bilangan bulat 0 atau lebih.",
      );
    }
    if (row.jumlahDisetujui > target.jumlah) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        `Jumlah disetujui item "${target.item.nama}" melebihi jumlah diminta.`,
      );
    }
    approved.set(row.id, row.jumlahDisetujui);
  }

  return approved;
}

async function lockWipRowsFifo(
  tx: PrismaTransactionClient,
  divisiId: number,
  itemId: number,
): Promise<WipLockRow[]> {
  return tx.$queryRaw<WipLockRow[]>`
    SELECT pmi.id, pmi.jumlahSisa
    FROM PemakaianMaterialItem pmi
    INNER JOIN PemakaianMaterial pm ON pm.id = pmi.pemakaianId
    WHERE pm.divisiId = ${divisiId}
      AND pmi.itemId = ${itemId}
      AND pmi.jumlahSisa > 0
    ORDER BY pm.tanggal ASC, pmi.id ASC
    FOR UPDATE
  `;
}

async function approveInTx(
  tx: PrismaTransactionClient,
  id: number,
  input: ApprovalWipTransferInput,
  access: WipTransferAccess,
): Promise<WipTransferDetail> {
  const locked = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM WipTransfer WHERE id = ${id} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new WipTransferError(
      WIP_TRANSFER_TIDAK_DITEMUKAN,
      "Transfer WIP tidak ditemukan.",
    );
  }

  const transfer = await tx.wipTransfer.findUnique({
    where: { id },
    include: WIP_TRANSFER_INCLUDE,
  });
  if (!transfer) {
    throw new WipTransferError(
      WIP_TRANSFER_TIDAK_DITEMUKAN,
      "Transfer WIP tidak ditemukan.",
    );
  }

  pastikanBolehApprove(transfer, access);

  if (transfer.status === StatusWipTransfer.DISETUJUI) {
    return detailWithWipTersedia(tx, transfer);
  }
  if (transfer.status === StatusWipTransfer.DITOLAK) {
    throw new WipTransferError(
      TRANSFER_TERKUNCI,
      "Transfer WIP sudah ditolak dan tidak dapat diubah.",
    );
  }
  if (
    input.status !== StatusWipTransfer.DISETUJUI &&
    input.status !== StatusWipTransfer.DITOLAK
  ) {
    throw new WipTransferError(
      STATUS_TIDAK_VALID,
      "Status approval harus DISETUJUI atau DITOLAK.",
    );
  }

  const approvedAt = new Date();
  const reject = async (): Promise<WipTransferDetail> => {
    await tx.wipTransferItem.updateMany({
      where: { transferId: id },
      data: { jumlahDisetujui: 0, pemakaianMaterialItemId: null },
    });
    await tx.wipTransfer.update({
      where: { id },
      data: {
        status: StatusWipTransfer.DITOLAK,
        approvedById: access.userId,
        approvedAt,
      },
    });
    const updated = await tx.wipTransfer.findUniqueOrThrow({
      where: { id },
      include: WIP_TRANSFER_INCLUDE,
    });
    return detailWithWipTersedia(tx, updated);
  };

  if (input.status === StatusWipTransfer.DITOLAK) {
    return reject();
  }

  const approved = buildApprovalMap(transfer.items, input);
  const approvedItems = transfer.items.filter(
    (item) => (approved.get(item.id) ?? 0) > 0,
  );
  if (approvedItems.length === 0) {
    return reject();
  }

  const routedItems = [...new Set(approvedItems.map((item) => item.itemId))];
  const activeRoutings = await tx.productionRouting.findMany({
    where: {
      isActive: true,
      bom: { isActive: true },
      stages: {
        some: {
          divisiId: transfer.divisiAsalId,
          outputItemId: { in: routedItems },
        },
      },
    },
    select: {
      bom: { select: { berlakuMulai: true, berlakuSelesai: true } },
      stages: {
        orderBy: { sequence: "asc" },
        select: { divisiId: true, inputItemId: true, outputItemId: true },
      },
    },
  });
  const now = new Date();
  const currentRoutings = activeRoutings.filter(({ bom }) =>
    (bom.berlakuMulai === null || bom.berlakuMulai <= now) &&
    (bom.berlakuSelesai === null || bom.berlakuSelesai >= now),
  );
  for (const itemId of routedItems) {
    const itemHasRouting = currentRoutings.some((routing) =>
      routing.stages.some((stage) =>
        stage.divisiId === transfer.divisiAsalId &&
        stage.outputItemId === itemId,
      ),
    );
    const allowed = currentRoutings.some((routing) =>
      routing.stages.some((stage) =>
        stage.divisiId === transfer.divisiAsalId &&
        stage.outputItemId === itemId,
      ) &&
      isAllowedProductionStageTransfer(
        routing.stages,
        transfer.divisiAsalId,
        transfer.divisiTujuanId,
        itemId,
      ),
    );
    if (itemHasRouting && !allowed) {
      throw new WipTransferError(
        "ROUTING_INVALID",
        "WIP hanya dapat dikirim ke divisi tahap berikutnya sesuai routing aktif.",
      );
    }
  }

  // Kunci baris Item dengan urutan stabil, lalu lot WIP FIFO per item.
  const itemIds = [...new Set(approvedItems.map((item) => item.itemId))].sort(
    (a, b) => a - b,
  );
  for (const itemId of itemIds) {
    await lockItem(tx, itemId);
  }

  const alokasi: AlokasiInput[] = [];
  const kekurangan: WipTransferKekuranganItem[] = [];

  for (const transferItem of approvedItems.sort(
    (a, b) => a.itemId - b.itemId || a.id - b.id,
  )) {
    const diminta = approved.get(transferItem.id) ?? 0;
    const rows = await lockWipRowsFifo(
      tx,
      transfer.divisiAsalId,
      transferItem.itemId,
    );

    let sisa = diminta;
    let tersedia = 0;
    for (const row of rows) {
      const lot = Number(row.jumlahSisa) || 0;
      if (lot <= 0) continue;
      tersedia += lot;
      if (sisa <= 0) continue;
      const pakai = Math.min(lot, sisa);
      if (pakai <= 0) continue;
      alokasi.push({
        transferItemId: transferItem.id,
        pemakaianMaterialItemId: row.id,
        jumlah: pakai,
      });
      sisa -= pakai;
    }

    if (sisa > 0) {
      kekurangan.push({
        transferItemId: transferItem.id,
        itemId: transferItem.itemId,
        kode: transferItem.item.kode,
        nama: transferItem.item.nama,
        unit: transferItem.item.unit,
        diminta,
        tersedia,
        kekurangan: sisa,
      });
    }
  }

  if (kekurangan.length > 0) {
    throw new WipTransferKurangError({
      divisiAsalId: transfer.divisiAsalId,
      items: kekurangan,
    });
  }

  const transferItemById = new Map(
    transfer.items.map((item) => [item.id, item]),
  );
  for (const row of alokasi) {
    const transferItem = transferItemById.get(row.transferItemId);
    if (!transferItem) {
      throw new WipTransferError(
        APPROVAL_TIDAK_VALID,
        "Item transfer tidak konsisten.",
      );
    }
    const updated = await tx.pemakaianMaterialItem.updateMany({
      where: {
        id: row.pemakaianMaterialItemId,
        jumlahSisa: { gte: row.jumlah },
      },
      data: {
        jumlahSisa: { decrement: row.jumlah },
        jumlahDipakai: { increment: row.jumlah },
      },
    });
    if (updated.count !== 1) {
      throw new WipTransferKurangError({
        divisiAsalId: transfer.divisiAsalId,
        items: [
          {
            transferItemId: row.transferItemId,
            itemId: transferItem.itemId,
            kode: transferItem.item.kode,
            nama: transferItem.item.nama,
            unit: transferItem.item.unit,
            diminta: row.jumlah,
            tersedia: 0,
            kekurangan: row.jumlah,
          },
        ],
      });
    }
  }

  const target = await tx.pemakaianMaterial.create({
    data: {
      nomor: `WIP-${transfer.nomor}`,
      permintaanId: null,
      divisiId: transfer.divisiTujuanId,
      tanggal: approvedAt,
      userId: access.userId,
      sumber: SumberPemakaianMaterial.TRANSFER_WIP,
      wipTransferId: transfer.id,
      keterangan: `Transfer WIP ${transfer.nomor}`,
      items: {
        create: approvedItems.map((item) => {
          const jumlah = approved.get(item.id) ?? 0;
          return {
            itemId: item.itemId,
            permintaanBarangItemId: null,
            hasilProduksiHarianItemId: null,
            jumlahDiterima: jumlah,
            jumlahDipakai: 0,
            jumlahSisa: jumlah,
            satuan: item.satuan ?? item.item.unit,
            keteranganSisa: null,
          };
        }),
      },
    },
    select: {
      id: true,
      items: { select: { id: true, itemId: true } },
    },
  });

  const targetByItem = new Map<number, number>();
  for (const item of target.items) {
    if (item.itemId !== null) targetByItem.set(item.itemId, item.id);
  }

  await tx.wipTransferAlokasi.createMany({
    data: alokasi.map((row) => ({
      transferItemId: row.transferItemId,
      pemakaianMaterialItemId: row.pemakaianMaterialItemId,
      jumlah: row.jumlah,
    })),
  });

  const [sourceLocation, destinationLocation] = await Promise.all([
    ensureDivisionInventoryLocation(tx, transfer.divisiAsalId),
    ensureDivisionInventoryLocation(tx, transfer.divisiTujuanId),
  ]);
  for (const row of alokasi) {
    const transferItem = transferItemById.get(row.transferItemId);
    if (!transferItem) {
      throw new WipTransferError(APPROVAL_TIDAK_VALID, "Item transfer tidak konsisten.");
    }
    await postInventoryMovementInTransaction(tx, {
      itemId: transferItem.itemId,
      pemakaianMaterialItemId: row.pemakaianMaterialItemId,
      fromLocationId: sourceLocation.id,
      type: "TRANSFER",
      quantity: row.jumlah,
      idempotencyKey: `wip-transfer:${id}:out:${row.transferItemId}:${row.pemakaianMaterialItemId}`,
      sourceType: "WIP_TRANSFER",
      sourceId: `${id}:out:${row.transferItemId}:${row.pemakaianMaterialItemId}`,
      reason: `WIP keluar transfer ${transfer.nomor}`,
      userId: access.userId,
      occurredAt: approvedAt,
    });
  }

  for (const transferItem of approvedItems) {
    const quantity = approved.get(transferItem.id) ?? 0;
    const targetLotId = targetByItem.get(transferItem.itemId);
    if (!targetLotId || quantity <= 0) {
      throw new WipTransferError(APPROVAL_TIDAK_VALID, "Lot tujuan transfer tidak terbentuk.");
    }
    await postInventoryMovementInTransaction(tx, {
      itemId: transferItem.itemId,
      pemakaianMaterialItemId: targetLotId,
      toLocationId: destinationLocation.id,
      type: "TRANSFER",
      quantity,
      idempotencyKey: `wip-transfer:${id}:in:${transferItem.id}`,
      sourceType: "WIP_TRANSFER",
      sourceId: `${id}:in:${transferItem.id}`,
      reason: `WIP masuk transfer ${transfer.nomor}`,
      userId: access.userId,
      occurredAt: approvedAt,
    });
  }

  for (const transferItem of transfer.items) {
    const jumlah = approved.get(transferItem.id) ?? 0;
    await tx.wipTransferItem.update({
      where: { id: transferItem.id },
      data: {
        jumlahDisetujui: jumlah,
        pemakaianMaterialItemId:
          jumlah > 0 ? targetByItem.get(transferItem.itemId) ?? null : null,
      },
    });
  }

  await tx.wipTransfer.update({
    where: { id },
    data: {
      status: StatusWipTransfer.DISETUJUI,
      approvedById: access.userId,
      approvedAt,
    },
  });

  const updated = await tx.wipTransfer.findUniqueOrThrow({
    where: { id },
    include: WIP_TRANSFER_INCLUDE,
  });
  return detailWithWipTersedia(tx, updated);
}

export async function approveWipTransfer(
  id: number,
  input: ApprovalWipTransferInput,
  access: WipTransferAccess,
): Promise<WipTransferDetail> {
  return prisma.$transaction((tx) => approveInTx(tx, id, input, access));
}

export async function deleteWipTransfer(
  id: number,
  access: WipTransferAccess,
): Promise<{ id: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM WipTransfer WHERE id = ${id} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new WipTransferError(
        WIP_TRANSFER_TIDAK_DITEMUKAN,
        "Transfer WIP tidak ditemukan.",
      );
    }

    const row = await tx.wipTransfer.findUnique({
      where: { id },
      select: {
        id: true,
        arah: true,
        status: true,
        divisiAsalId: true,
        divisiTujuanId: true,
      },
    });
    if (!row) {
      throw new WipTransferError(
        WIP_TRANSFER_TIDAK_DITEMUKAN,
        "Transfer WIP tidak ditemukan.",
      );
    }

    if (!access.admin) {
      if (!access.divisiId) {
        throw new WipTransferError(
          DIVISI_TIDAK_TERHUBUNG,
          "Akun belum terhubung ke divisi.",
        );
      }
      const pembuatDivisiId =
        row.arah === ArahWipTransfer.MINTA
          ? row.divisiTujuanId
          : row.divisiAsalId;
      if (pembuatDivisiId !== access.divisiId) {
        throw new WipTransferError(
          AKSES_DITOLAK,
          "Hanya divisi pembuat yang boleh menghapus transfer ini.",
        );
      }
    }

    if (row.status !== StatusWipTransfer.MENUNGGU) {
      throw new WipTransferError(
        TRANSFER_TERKUNCI,
        "Transfer WIP yang sudah final tidak dapat dihapus.",
      );
    }

    await tx.wipTransfer.delete({ where: { id } });
    return { id };
  });
}
