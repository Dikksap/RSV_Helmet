import { describe, expect, it } from "vitest";
import type { ProductionRouting } from "../../api/erp";
import {
  buildHpPayload,
  emptyRow,
  expectedUnitCount,
  hpFormSignature,
  nextIdempotencyKey,
  stageOptions,
  validateHpForm,
  type HpFormState,
} from "./hpForm";

function item(itemId: number, kode: string, unit = "pcs") {
  return { itemId, item: { id: itemId, kode, nama: `Item ${kode}`, unit } };
}

function stage(
  id: number,
  sequence: number,
  divisiId: number,
  inputItemIds: number[],
  outputItemIds: number[],
) {
  return {
    id,
    stage: `STAGE_${id}`,
    sequence,
    divisiId,
    inputItems: inputItemIds.map((itemId) => item(itemId, `IN${itemId}`)),
    outputItems: outputItemIds.map((itemId) => item(itemId, `OUT${itemId}`)),
    divisi: { id: divisiId, nama: `Divisi ${divisiId}` },
  };
}

const routing: ProductionRouting = {
  id: 1,
  version: 3,
  isActive: true,
  stages: [
    stage(11, 0, 1, [1, 2], [10]),
    stage(12, 1, 1, [10], [20, 21]),
  ],
};

function state(overrides: Partial<HpFormState> = {}): HpFormState {
  return {
    tanggal: "2026-11-09",
    divisiId: "1",
    stageKey: "1:12",
    keterangan: "",
    masuk: [{ ...emptyRow("m1"), itemId: "10", jumlah: "5" }],
    hasil: [{ ...emptyRow("h1"), itemId: "20", jumlah: "5", productVariantId: "7" }],
    keluar: [],
    ...overrides,
  };
}

describe("stageOptions", () => {
  it("memfilter stage per divisi dan menandai stage terakhir", () => {
    const options = stageOptions([routing], 1);

    expect(options.map((row) => row.stageId)).toEqual([11, 12]);
    expect(options[0].isLast).toBe(false);
    expect(options[1].isLast).toBe(true);
    expect(options[0].key).toBe("1:11");
    expect(options[0].routingVersion).toBe(3);
    expect(options[0].inputs.map((row) => row.itemId)).toEqual([1, 2]);
    expect(options[1].outputs.map((row) => row.itemId)).toEqual([20, 21]);
  });

  it("mengembalikan kosong untuk divisi tanpa routing / id tidak valid", () => {
    expect(stageOptions([routing], 99)).toEqual([]);
    expect(stageOptions([routing], 0)).toEqual([]);
  });
});

describe("validateHpForm", () => {
  const option = stageOptions([routing], 1)[1];

  it("lulus untuk form lengkap stage terakhir", () => {
    expect(validateHpForm(state(), option)).toEqual([]);
  });

  it("menyaratkan pilihan stage", () => {
    expect(validateHpForm(state(), null)).toContain("Pilih tahap routing produksi terlebih dahulu.");
  });

  it("menyaratkan minimal satu MASUK dan satu HASIL", () => {
    const errors = validateHpForm(
      state({ masuk: [emptyRow("m1")], hasil: [emptyRow("h1")] }),
      option,
    );
    expect(errors.join(" ")).toContain("minimal satu baris MASUK");
    expect(errors.join(" ")).toContain("minimal satu baris HASIL");
  });

  it("menolak item duplikat dan jumlah bukan bilangan bulat", () => {
    const errors = validateHpForm(
      state({
        masuk: [
          { ...emptyRow("m1"), itemId: "10", jumlah: "2" },
          { ...emptyRow("m2"), itemId: "10", jumlah: "3" },
        ],
        hasil: [{ ...emptyRow("h1"), itemId: "20", jumlah: "2.5", productVariantId: "7" }],
      }),
      option,
    );
    expect(errors.join(" ")).toContain("tidak boleh dicatat dua kali");
    expect(errors.join(" ")).toContain("jumlah harus bilangan bulat");
  });

  it("mewajibkan ProductVariant pada stage terakhir", () => {
    const errors = validateHpForm(
      state({ hasil: [{ ...emptyRow("h1"), itemId: "20", jumlah: "5" }] }),
      option,
    );
    expect(errors.join(" ")).toContain("stage terakhir wajib memilih ProductVariant");
  });

  it("tidak mewajibkan ProductVariant pada stage non-terakhir", () => {
    const nonLast = stageOptions([routing], 1)[0];
    const errors = validateHpForm(
      state({
        stageKey: nonLast.key,
        masuk: [{ ...emptyRow("m1"), itemId: "1", jumlah: "2" }],
        hasil: [{ ...emptyRow("h1"), itemId: "10", jumlah: "2" }],
      }),
      nonLast,
    );
    expect(errors).toEqual([]);
  });

  it("menolak item di luar input/output stage dan konflik MASUK/KELUAR", () => {
    const errors = validateHpForm(
      state({
        masuk: [{ ...emptyRow("m1"), itemId: "999", jumlah: "1" }],
        keluar: [{ ...emptyRow("k1"), itemId: "999", jumlah: "1" }],
      }),
      option,
    );
    expect(errors.join(" ")).toContain("tidak termasuk input stage");
    expect(errors.join(" ")).toContain("MASUK dan KELUAR sekaligus");
  });
});

describe("buildHpPayload", () => {
  const option = stageOptions([routing], 1)[1];

  it("menyusun payload MASUK/KELUAR/HASIL sesuai tipe dan menyertakan varian", () => {
    const payload = buildHpPayload(
      state({
        keluar: [{ ...emptyRow("k1"), itemId: "1", jumlah: "1" }],
        keterangan: "  shift 1  ",
      }),
      option,
      "key-123",
    );

    expect(payload.divisiId).toBe(1);
    expect(payload.routingStageId).toBe(12);
    expect(payload.idempotencyKey).toBe("key-123");
    expect(payload.keterangan).toBe("shift 1");
    expect(payload.tanggalProduksi).toBe("2026-11-09");
    expect(payload.items).toEqual([
      { itemId: 10, tipe: "MASUK", jumlah: 5 },
      { itemId: 1, tipe: "KELUAR", jumlah: 1 },
      { itemId: 20, tipe: "HASIL", jumlah: 5, productVariantId: 7 },
    ]);
  });

  it("tidak mengirim productVariantId untuk stage non-terakhir", () => {
    const nonLast = stageOptions([routing], 1)[0];
    const payload = buildHpPayload(
      state({
        stageKey: nonLast.key,
        masuk: [{ ...emptyRow("m1"), itemId: "1", jumlah: "2" }],
        hasil: [{ ...emptyRow("h1"), itemId: "10", jumlah: "2", productVariantId: "7" }],
      }),
      nonLast,
      "key",
    );

    expect(payload.routingStageId).toBe(11);
    expect(payload.items.find((row) => row.tipe === "HASIL")).toEqual({
      itemId: 10,
      tipe: "HASIL",
      jumlah: 2,
    });
  });
});

describe("idempotency key", () => {
  const option = stageOptions([routing], 1)[1];

  it("memakai ulang key hanya untuk payload identik", () => {
    const first = state();
    const signature = hpFormSignature(first, option);
    const reused = nextIdempotencyKey(signature, { signature, idempotencyKey: "same" }, () => "new");

    expect(reused).toBe("same");
    expect(nextIdempotencyKey(hpFormSignature(state({ hasil: [{ ...emptyRow("h1"), itemId: "20", jumlah: "9", productVariantId: "7" }] }), option), { signature, idempotencyKey: "same" }, () => "new")).toBe("new");
  });

  it("membuat key baru tanpa percobaan sebelumnya", () => {
    const signature = hpFormSignature(state(), option);
    expect(nextIdempotencyKey(signature, null, () => "fresh")).toBe("fresh");
  });

  it("menghitung unit QR yang diharapkan", () => {
    expect(expectedUnitCount(state(), option)).toBe(5);
    expect(expectedUnitCount(state(), stageOptions([routing], 1)[0])).toBe(0);
  });

  it("mendukung tahap Perakitan tanpa item output tabel (hanya ProductVariant)", () => {
    const perakitanRouting: ProductionRouting = {
      id: 2,
      version: 1,
      isActive: true,
      stages: [
        stage(21, 0, 6, [20, 21], []),
      ],
    };
    const perakitanOption = stageOptions([perakitanRouting], 6)[0];
    expect(perakitanOption.isLast).toBe(true);

    const perakitanState: HpFormState = {
      tanggal: "2026-11-10",
      divisiId: "6",
      stageKey: perakitanOption.key,
      keterangan: "Perakitan helm jadi",
      masuk: [{ ...emptyRow("m1"), itemId: "20", jumlah: "5" }],
      hasil: [{ ...emptyRow("h1"), itemId: "", productVariantId: "3", jumlah: "5" }],
      keluar: [],
    };

    expect(validateHpForm(perakitanState, perakitanOption)).toEqual([]);
    const payload = buildHpPayload(perakitanState, perakitanOption, "key-perakitan");
    expect(payload.items).toEqual([
      { itemId: 20, tipe: "MASUK", jumlah: 5 },
      { tipe: "HASIL", productVariantId: 3, jumlah: 5 },
    ]);
    expect(expectedUnitCount(perakitanState, perakitanOption)).toBe(5);
  });
});
