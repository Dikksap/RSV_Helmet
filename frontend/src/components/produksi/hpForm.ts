import type { ProductionRouting } from "../../api/erp";
import type {
  HasilProduksiItemInput,
  HasilProduksiPayload,
  TipeHasilProduksi,
} from "../../api/hasilProduksiHarian";

/**
 * Logika murni form Hasil Produksi Harian (HP) supaya aturan validasi dan
 * payload dapat diuji tanpa merender komponen.
 *
 * Aturan yang dijaga sama dengan backend:
 * - minimal satu MASUK dan satu HASIL;
 * - satu item hanya boleh muncul sekali per tipe (MASUK/HASIL);
 * - item tidak boleh punya baris MASUK dan KELUAR sekaligus;
 * - ProductVariant wajib pada baris HASIL di stage terakhir;
 * - jumlah harus bilangan bulat > 0.
 */

export type StageItemRef = {
  itemId: number;
  kode: string;
  nama: string;
  unit: string | null;
};

export type StageOption = {
  key: string;
  routingId: number;
  routingVersion: number;
  stageId: number;
  stage: string;
  sequence: number;
  isLast: boolean;
  divisiId: number;
  inputs: StageItemRef[];
  outputs: StageItemRef[];
};

export type RowDraft = {
  key: string;
  itemId: string;
  productVariantId: string;
  jumlah: string;
  keterangan: string;
};

export type HpFormState = {
  tanggal: string;
  divisiId: string;
  stageKey: string;
  keterangan: string;
  masuk: RowDraft[];
  hasil: RowDraft[];
  keluar: RowDraft[];
};

export const emptyRow = (key: string): RowDraft => ({
  key,
  itemId: "",
  productVariantId: "",
  jumlah: "",
  keterangan: "",
});

function toItemRef(row: {
  itemId: number;
  item: { kode: string; nama: string; unit: string | null } | null;
}): StageItemRef | null {
  if (!row.item) return null;
  return {
    itemId: row.itemId,
    kode: row.item.kode,
    nama: row.item.nama,
    unit: row.item.unit,
  };
}

/** Daftar stage yang boleh dipakai divisi tertentu, beserta penanda stage akhir. */
export function stageOptions(routings: ProductionRouting[], divisiId: number): StageOption[] {
  if (!Number.isInteger(divisiId) || divisiId <= 0) return [];
  const options: StageOption[] = [];
  for (const routing of routings) {
    const stages = [...routing.stages].sort((a, b) => a.sequence - b.sequence);
    const lastSequence = stages[stages.length - 1]?.sequence ?? 0;
    for (const stage of stages) {
      if (stage.divisiId !== divisiId) continue;
      const inputs = stage.inputItems
        .map(toItemRef)
        .filter((row): row is StageItemRef => row !== null);
      const outputs = stage.outputItems
        .map(toItemRef)
        .filter((row): row is StageItemRef => row !== null);
      options.push({
        key: `${routing.id}:${stage.id}`,
        routingId: routing.id,
        routingVersion: routing.version,
        stageId: stage.id,
        stage: stage.stage,
        sequence: stage.sequence,
        isLast: stage.sequence >= lastSequence || stage.outputItems.length === 0,
        divisiId: stage.divisiId,
        inputs,
        outputs,
      });
    }
  }
  return options.sort(
    (a, b) => a.routingVersion - b.routingVersion || a.sequence - b.sequence,
  );
}

function isPositiveInteger(value: string): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function rowErrors(rows: RowDraft[], label: string, isVariantStage = false): string[] {
  const errors: string[] = [];
  const seenItems = new Set<string>();
  const seenVariants = new Set<string>();
  for (const row of rows) {
    if (isVariantStage) {
      const variantId = Number(row.productVariantId);
      if (!Number.isInteger(variantId) || variantId <= 0) {
        errors.push("HASIL: stage terakhir wajib memilih ProductVariant untuk setiap output.");
        continue;
      }
      if (seenVariants.has(row.productVariantId)) {
        errors.push("HASIL: satu ProductVariant hanya boleh muncul pada satu baris.");
      }
      seenVariants.add(row.productVariantId);
    } else {
      const itemId = Number(row.itemId);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        errors.push(`${label}: pilih item pada setiap baris.`);
        continue;
      }
      if (seenItems.has(row.itemId)) {
        errors.push(`${label}: item yang sama tidak boleh dicatat dua kali.`);
      }
      seenItems.add(row.itemId);
    }
    if (!isPositiveInteger(row.jumlah)) {
      errors.push(`${label}: jumlah harus bilangan bulat lebih dari 0.`);
    }
  }
  return errors;
}

export function validateHpForm(state: HpFormState, option: StageOption | null): string[] {
  const errors: string[] = [];
  if (!state.tanggal) errors.push("Tanggal produksi wajib diisi.");
  if (!state.divisiId) errors.push("Divisi produksi wajib dipilih.");
  if (!option) {
    errors.push("Pilih tahap routing produksi terlebih dahulu.");
    return errors;
  }
  const masuk = state.masuk.filter((row) => row.itemId || row.jumlah);
  const hasil = state.hasil.filter((row) => row.itemId || row.jumlah || row.productVariantId);
  const keluar = state.keluar.filter((row) => row.itemId || row.jumlah);

  if (masuk.length === 0) errors.push("Wajib ada minimal satu baris MASUK (material/WIP yang dipakai).");
  if (hasil.length === 0) errors.push("Wajib ada minimal satu baris HASIL (output proses).");
  errors.push(...rowErrors(masuk, "MASUK", false));
  errors.push(...rowErrors(hasil, "HASIL", option.isLast));
  if (keluar.length > 0) errors.push(...rowErrors(keluar, "KELUAR", false));

  const allowedInputs = new Set(option.inputs.map((row) => String(row.itemId)));
  for (const row of masuk) {
    if (row.itemId && !allowedInputs.has(row.itemId)) {
      errors.push(`MASUK: item tidak termasuk input stage ${option.stage}.`);
    }
  }

  if (!option.isLast && option.outputs.length > 0) {
    const allowedOutputs = new Set(option.outputs.map((row) => String(row.itemId)));
    for (const row of hasil) {
      if (row.itemId && !allowedOutputs.has(row.itemId)) {
        errors.push(`HASIL: item tidak termasuk output stage ${option.stage}.`);
      }
    }
  }

  const hasilItems = new Set(masuk.map((row) => row.itemId));
  for (const row of keluar) {
    if (row.itemId && hasilItems.has(row.itemId)) {
      errors.push("Item yang sama tidak boleh punya baris MASUK dan KELUAR sekaligus.");
    }
  }

  return [...new Set(errors)];
}

function collect(
  rows: RowDraft[],
  tipe: TipeHasilProduksi,
  withVariant: boolean,
): HasilProduksiItemInput[] {
  return rows
    .filter((row) => (withVariant ? row.productVariantId : row.itemId) && row.jumlah)
    .map((row) => ({
      ...(row.itemId ? { itemId: Number(row.itemId) } : {}),
      tipe,
      jumlah: Number(row.jumlah),
      ...(row.keterangan.trim() ? { keterangan: row.keterangan.trim() } : {}),
      ...(withVariant && row.productVariantId
        ? { productVariantId: Number(row.productVariantId) }
        : {}),
    }));
}

export function buildHpPayload(
  state: HpFormState,
  option: StageOption,
  idempotencyKey: string,
): HasilProduksiPayload {
  return {
    ...(state.tanggal ? { tanggalProduksi: state.tanggal } : {}),
    divisiId: Number(state.divisiId),
    routingStageId: option.stageId,
    idempotencyKey,
    ...(state.keterangan.trim() ? { keterangan: state.keterangan.trim() } : {}),
    items: [
      ...collect(state.masuk, "MASUK", false),
      ...collect(state.keluar, "KELUAR", false),
      ...collect(state.hasil, "HASIL", option.isLast),
    ],
  };
}

function normalizedRows(rows: RowDraft[]) {
  return rows
    .filter((row) => row.itemId || row.jumlah || row.productVariantId)
    .map((row) => ({
      itemId: row.itemId,
      productVariantId: row.productVariantId,
      jumlah: row.jumlah,
      keterangan: row.keterangan.trim(),
    }));
}

/** Sidik jari payload untuk memutuskan apakah idempotency key boleh dipakai ulang. */
export function hpFormSignature(state: HpFormState, option: StageOption | null): string {
  return JSON.stringify({
    tanggal: state.tanggal,
    divisiId: state.divisiId,
    stage: option?.stageId ?? null,
    keterangan: state.keterangan.trim(),
    masuk: normalizedRows(state.masuk),
    hasil: normalizedRows(state.hasil),
    keluar: normalizedRows(state.keluar),
  });
}

export type LastHpAttempt = { signature: string; idempotencyKey: string };

/**
 * Key yang sama hanya dipakai ulang bila payload identik (retry aman).
 * Jika pengguna mengubah isi form, key baru dibuat agar tidak berakhir
 * dengan `IDEMPOTENCY_CONFLICT`.
 */
export function nextIdempotencyKey(
  signature: string,
  lastAttempt: LastHpAttempt | null,
  uuid: () => string = () => crypto.randomUUID(),
): string {
  if (lastAttempt && lastAttempt.signature === signature) return lastAttempt.idempotencyKey;
  return uuid();
}

/** Ringkasan unit FG yang akan dibuat (baris HASIL bervarian). */
export function expectedUnitCount(state: HpFormState, option: StageOption | null): number {
  if (!option?.isLast) return 0;
  return state.hasil.reduce((total, row) => {
    if (!row.productVariantId) return total;
    const n = Number(row.jumlah);
    return Number.isInteger(n) && n > 0 ? total + n : total;
  }, 0);
}
