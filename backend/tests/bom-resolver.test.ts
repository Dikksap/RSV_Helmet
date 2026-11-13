import { describe, expect, it, vi } from "vitest";
import {
  BomError,
  explodeVariantBom,
  resolveEffectiveBomForVariant,
} from "../src/model/bom/resolver.js";

const itemRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  kode: `I${id}`,
  nama: `Item ${id}`,
  jenis: null,
  unit: "pcs",
  ...extra,
});

function bomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    version: "1",
    isActive: true,
    productVariantId: 5,
    subassemblyId: null,
    items: [],
    ...overrides,
  };
}

function buatTx(handler: (args: any) => unknown) {
  return {
    bom: {
      findMany: vi.fn(handler),
      count: vi.fn().mockResolvedValue(1),
    },
    subassembly: { findUnique: vi.fn().mockResolvedValue(null) },
  } as any;
}

const tanggal = new Date("2026-11-01T00:00:00+07:00");

describe("resolveEffectiveBomForVariant", () => {
  it("menolak bila tidak ada BOM sama sekali (BOM_NOT_FOUND)", async () => {
    const tx = buatTx(() => []);
    tx.bom.count.mockResolvedValue(0);
    await expect(resolveEffectiveBomForVariant(tx, 5, tanggal)).rejects.toMatchObject({
      code: "BOM_NOT_FOUND",
    });
  });

  it("menolak bila BOM ada tetapi tidak berlaku pada tanggal (BOM_NOT_EFFECTIVE)", async () => {
    const tx = buatTx(() => []);
    tx.bom.count.mockResolvedValue(2);
    await expect(resolveEffectiveBomForVariant(tx, 5, tanggal)).rejects.toBeInstanceOf(BomError);
    await expect(resolveEffectiveBomForVariant(tx, 5, tanggal)).rejects.toMatchObject({
      code: "BOM_NOT_EFFECTIVE",
    });
  });

  it("menolak bila lebih dari satu BOM aktif berlaku (BOM_AMBIGU), tidak memilih diam-diam", async () => {
    const tx = buatTx(() => [bomRow({ id: 1 }), bomRow({ id: 2, version: "2" })]);
    await expect(resolveEffectiveBomForVariant(tx, 5, tanggal)).rejects.toMatchObject({
      code: "BOM_AMBIGU",
    });
  });

  it("memakai filter isActive + berlakuMulai/berlakuSelesai pada query", async () => {
    const tx = buatTx(() => [bomRow()]);
    await resolveEffectiveBomForVariant(tx, 5, tanggal);
    const where = tx.bom.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ productVariantId: 5, isActive: true });
    expect(JSON.stringify(where)).toContain("berlakuMulai");
    expect(JSON.stringify(where)).toContain("berlakuSelesai");
  });
});

describe("explodeVariantBom", () => {
  it("menghitung kebutuhan bertingkat dengan scrap dan menandai ekspansi lengkap", async () => {
    const parent = bomRow({
      id: 10,
      items: [
        {
          id: 1,
          parentBomItemId: null,
          quantity: 2,
          scrapPercent: 10,
          itemId: 1,
          item: itemRow(1),
          subassemblyId: null,
          subassembly: null,
        },
        {
          id: 2,
          parentBomItemId: null,
          quantity: 1,
          scrapPercent: null,
          itemId: null,
          item: null,
          subassemblyId: 9,
          subassembly: { id: 9, kode: "SA9" },
        },
      ],
    });
    const child = bomRow({
      id: 11,
      productVariantId: null,
      subassemblyId: 9,
      items: [
        {
          id: 3,
          parentBomItemId: null,
          quantity: 3,
          scrapPercent: null,
          itemId: 3,
          item: itemRow(3),
          subassemblyId: null,
          subassembly: null,
        },
      ],
    });

    const tx = buatTx((args) => (args.where.productVariantId !== undefined ? [parent] : [child]));

    const hasil = await explodeVariantBom(tx, 5, 4, tanggal);

    expect(hasil.bomId).toBe(10);
    expect(hasil.incomplete).toBe(false);
    // item 1: 2 * 4 * 1.1 = 8.8 ; item 3: 1 * 3 * 4 = 12
    expect(hasil.lines).toEqual([
      expect.objectContaining({ itemId: 1, quantity: 8.8 }),
      expect.objectContaining({ itemId: 3, quantity: 12 }),
    ]);
  });

  it("menandai BOM_TIDAK_LENGKAP saat BOM anak tidak ditemukan dan tidak menebak", async () => {
    const parent = bomRow({
      items: [
        {
          id: 1,
          parentBomItemId: null,
          quantity: 1,
          scrapPercent: null,
          itemId: null,
          item: null,
          subassemblyId: 9,
          subassembly: { id: 9, kode: "SA9" },
        },
      ],
    });
    let call = 0;
    const tx = buatTx(() => {
      call += 1;
      return call === 1 ? [parent] : [];
    });
    tx.bom.count.mockResolvedValue(1);

    const hasil = await explodeVariantBom(tx, 5, 1, tanggal);
    expect(hasil.incomplete).toBe(true);
    expect(hasil.lines).toEqual([]);
  });

  it("menolak siklus subassembly", async () => {
    const parent = bomRow({
      id: 20,
      subassemblyId: 9,
      productVariantId: null,
      items: [
        {
          id: 1,
          parentBomItemId: null,
          quantity: 1,
          scrapPercent: null,
          itemId: null,
          item: null,
          subassemblyId: 9,
          subassembly: { id: 9, kode: "SA9" },
        },
      ],
    });
    const tx = buatTx(() => [parent]);
    await expect(explodeVariantBom(tx, 5, 1, tanggal)).rejects.toMatchObject({
      code: "BOM_SIKLIKUS",
    });
  });
});
