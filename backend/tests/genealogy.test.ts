import { describe, expect, it } from "vitest";
import {
  leavesForLotQuantity,
  unitLeaves,
  type LotGraphLoader,
  type LotNode,
} from "../src/model/reports/genealogy.js";

const itemInfo = (id: number, jenis: string | null = null) => ({
  itemId: id,
  kode: `I${id}`,
  nama: `Item ${id}`,
  jenis,
  unit: "pcs",
});

function loaderFrom(lots: LotNode[]): LotGraphLoader {
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  return {
    async loadLot(lotId: number) {
      return byId.get(lotId) ?? null;
    },
  };
}

function lot(overrides: Partial<LotNode> & Pick<LotNode, "id" | "itemId">): LotNode {
  const item = itemInfo(overrides.itemId, overrides.item?.jenis ?? null);
  return {
    id: overrides.id,
    itemId: overrides.itemId,
    item: overrides.item ?? item,
    jumlahDiterima: overrides.jumlahDiterima ?? 1,
    hasilProduksiHarianItemId: overrides.hasilProduksiHarianItemId ?? (overrides.run ? 1 : null),
    run: overrides.run ?? null,
    transferSources: overrides.transferSources ?? [],
  };
}

/**
 * Rantai uji:
 * Lot 1 (RAW, sumber)
 *   → dimakan 2 unit oleh run R1 (total output 2) → Lot 2 (SM)
 * Lot 2 + Lot 1
 *   → dimakan run R2 (1 unit Lot 2 + 3 unit Lot 1, total output 2) → Lot 3 (final)
 *
 * Per 1 unit Lot 3 = 0.5 unit Lot 2 + 1.5 unit Lot 1
 *                    = 0.5 × (1 unit Lot 1) + 1.5 unit Lot 1 = 2 unit Lot 1.
 */
function rantai(): LotGraphLoader {
  return loaderFrom([
    lot({ id: 1, itemId: 1, jumlahDiterima: 100 }),
    lot({
      id: 2,
      itemId: 2,
      item: itemInfo(2, "SM"),
      jumlahDiterima: 2,
      run: {
        id: 11,
        nomor: "HP-1",
        tanggalProduksi: new Date("2026-11-01T00:00:00+07:00"),
        totalOutput: 2,
        consumptions: [{ lotId: 1, jumlah: 2 }],
      },
    }),
    lot({
      id: 3,
      itemId: 3,
      jumlahDiterima: 2,
      run: {
        id: 12,
        nomor: "HP-2",
        tanggalProduksi: new Date("2026-11-02T00:00:00+07:00"),
        totalOutput: 2,
        consumptions: [
          { lotId: 2, jumlah: 1 },
          { lotId: 1, jumlah: 3 },
        ],
      },
    }),
  ]);
}

describe("genealogi lot", () => {
  it("menelusuri material daun dan TIDAK menghitung SM dua kali", async () => {
    const result = await unitLeaves(rantai(), 3);

    expect(result.incomplete).toBe(false);
    expect([...result.leaves.keys()]).toEqual([1]);
    expect(result.leaves.get(1)?.quantity).toBeCloseTo(2, 6);
  });

  it("membagi konsumsi run secara proporsional terhadap total output (split/merge)", async () => {
    const loader = rantai();
    const perUnit = await unitLeaves(loader, 3);
    const forNinety = await leavesForLotQuantity(loader, 3, 90);

    expect(perUnit.leaves.get(1)?.quantity).toBeCloseTo(2, 6);
    expect(forNinety.leaves[0]).toMatchObject({ itemId: 1, kode: "I1" });
    expect(forNinety.leaves[0].quantity).toBeCloseTo(180, 6);
  });

  it("lot tanpa baris produksi adalah material daun", async () => {
    const result = await unitLeaves(rantai(), 1);
    expect(result.incomplete).toBe(false);
    expect(result.leaves.get(1)?.quantity).toBe(1);
  });

  it("lot yang tidak ditemukan ditandai tidak lengkap, bukan dikarang", async () => {
    const result = await unitLeaves(rantai(), 999);
    expect(result.incomplete).toBe(true);
    expect(result.leaves.size).toBe(0);
  });

  it("run tanpa total output diperlakukan sebagai daun (tidak membagi nol)", async () => {
    const loader = loaderFrom([
      lot({
        id: 5,
        itemId: 7,
        jumlahDiterima: 1,
        run: { id: 99, nomor: "HP-X", tanggalProduksi: new Date(), totalOutput: 0, consumptions: [] },
      }),
    ]);
    const result = await unitLeaves(loader, 5);
    expect(result.leaves.get(7)?.quantity).toBe(1);
  });

  it("meneruskan genealogi melewati lot hasil transfer WIP", async () => {
    // Lot 8 = lot tujuan transfer (tidak punya baris produksi) dari lot 9.
    // Lot 9 diproduksi run R9 yang mengonsumsi 2 unit Lot 1 untuk 1 output.
    const loader = loaderFrom([
      lot({ id: 1, itemId: 1, jumlahDiterima: 100 }),
      lot({
        id: 9,
        itemId: 9,
        jumlahDiterima: 1,
        run: {
          id: 90,
          nomor: "HP-90",
          tanggalProduksi: new Date("2026-11-01T00:00:00+07:00"),
          totalOutput: 1,
          consumptions: [{ lotId: 1, jumlah: 2 }],
        },
      }),
      lot({ id: 8, itemId: 9, jumlahDiterima: 1, transferSources: [{ lotId: 9, jumlah: 1 }] }),
    ]);

    const result = await unitLeaves(loader, 8);

    expect(result.incomplete).toBe(false);
    expect([...result.leaves.keys()]).toEqual([1]);
    expect(result.leaves.get(1)?.quantity).toBeCloseTo(2, 6);
  });

  it("mendeteksi siklus dan berhenti tanpa rekursi tak terbatas", async () => {
    const loader = loaderFrom([
      lot({
        id: 4,
        itemId: 4,
        run: { id: 1, nomor: "R1", tanggalProduksi: new Date(), totalOutput: 1, consumptions: [{ lotId: 5, jumlah: 1 }] },
      }),
      lot({
        id: 5,
        itemId: 5,
        run: { id: 2, nomor: "R2", tanggalProduksi: new Date(), totalOutput: 1, consumptions: [{ lotId: 4, jumlah: 1 }] },
      }),
    ]);

    const result = await unitLeaves(loader, 4);
    expect(result.incomplete).toBe(true);
  });
});
