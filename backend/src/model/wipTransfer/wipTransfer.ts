import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  ArahWipTransfer,
  StatusWipTransfer,
  SumberPemakaianMaterial,
} from "../../../generated/prisma/enums.js";
import { tanggalBisnis } from "../../lib/tanggalBisnis.js";
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
  inputItemIds: number[];
  outputItemIds: number[];
};

export function isAllowedProductionStageTransfer(
  stages: RoutingStageTransferCheck[],
  divisiAsalId: number,
  divisiTujuanId: number,
  itemId: number,
) {
  let isRoutingOutput = false;
  for (const [index, stage] of stages.entries()) {
    if (stage.divisiId !== divisiAsalId || !stage.outputItemIds.includes(itemId)) continue;
    isRoutingOutput = true;
    const nextStage = stages[index + 1];
    if (
      nextStage?.divisiId === divisiTujuanId &&
      nextStage.inputItemIds.includes(itemId)
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
      stages: {
        some: {
          divisiId: transfer.divisiAsalId,
          outputItems: { some: { itemId: { in: routedItems } } },
        },
      },
    },
    include: {
      stages: {
        orderBy: { sequence: "asc" },
        include: {
          inputItems: { select: { itemId: true } },
          outputItems: { select: { itemId: true } },
        },
      },
    },
  });
  for (const itemId of routedItems) {
    const itemHasRouting = activeRoutings.some((routing) =>
      routing.stages.some((stage) =>
        stage.divisiId === transfer.divisiAsalId &&
        stage.outputItems.some((output) => output.itemId === itemId),
      ),
    );
    const allowed = activeRoutings.some((routing) =>
      routing.stages.some((stage) =>
        stage.divisiId === transfer.divisiAsalId &&
        stage.outputItems.some((output) => output.itemId === itemId),
      ) &&
      isAllowedProductionStageTransfer(
        routing.stages.map((stage) => ({
          divisiId: stage.divisiId,
          inputItemIds: stage.inputItems.map((item) => item.itemId),
          outputItemIds: stage.outputItems.map((item) => item.itemId),
        })),
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
