import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  hasilProduksiHarian: { findUnique: vi.fn() },
}));

const stokMock = vi.hoisted(() => ({
  lockItem: vi.fn(),
  StokKurangError: class StokKurangError extends Error {
    readonly code = "STOK_KURANG";
    constructor(readonly itemId: number, readonly tersedia: number) {
      super(`Stok item ${itemId} tidak cukup (tersedia ${tersedia}).`);
    }
  },
}));

const inventoryMock = vi.hoisted(() => ({
  ensureDivisionInventoryLocation: vi.fn(),
  getItemStockAtLocation: vi.fn(),
  postInventoryMovementInTransaction: vi.fn(),
}));

const barangMock = vi.hoisted(() => ({
  generateBarangBulkInTransaction: vi.fn(),
}));

const bomMock = vi.hoisted(() => ({
  resolveEffectiveBomForVariant: vi.fn(),
  BomError: class BomError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "BomError";
    }
  },
}));

const permintaanMock = vi.hoisted(() => ({
  createPermintaan: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));
vi.mock("../src/model/stokItem/stokItem.js", () => stokMock);
vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);
vi.mock("../src/model/barang/barang.generate.js", () => barangMock);
vi.mock("../src/model/bom/resolver.js", () => bomMock);
vi.mock("../src/model/permintaanBarang/permintaanBarang.js", () => ({ createPermintaan: permintaanMock.createPermintaan }));

import {
  createHasilProduksi,
  HasilProduksiError,
  INPUT_TIDAK_VALID,
  IDEMPOTENCY_CONFLICT,
  WipKurangError,
} from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";

const item = (id: number) => ({
  id,
  kode: `ITM-${id}`,
  nama: `Item ${id}`,
  unit: "pcs",
  jenis: id === 2 ? "SM" : null,
  divisiId: 1,
  divisi: { id: 1, nama: "Buffing" },
});

let wipRowsByItem: Map<number, Array<{ id: number; jumlahSisa: unknown; jumlahDipakai: unknown }>>;
let routingStages: Array<Record<string, unknown>>;
let siblingSequences: number[];
let workOrderFixture: unknown;
let updateCount: number;
let tx: ReturnType<typeof buatTx>;
let generatedUnitIds: number[];

type StageFixture = {
  id: number;
  routingId: number;
  sequence: number;
  divisiId: number;
  stage: string;
  inputItems: Array<{ itemId: number }>;
  outputItems: Array<{ itemId: number }>;
  routing: { id: number; isActive: boolean };
};

function buatTx() {
  let urut = 1;
  return {
    divisi: { findUnique: vi.fn().mockResolvedValue({ id: 1, nama: "Buffing" }) },
    item: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: number[] } } }) =>
        where.id.in.filter((id) => id >= 1 && id <= 4).map(item),
      ),
    },
    productVariant: { findMany: vi.fn(async () => [{ id: 2, kodeVariant: "V002" }]) },
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Budi" }) },
    $queryRaw: vi.fn(async (...args: unknown[]) => wipRowsByItem.get(Number(args[2])) ?? []),
    pemakaianMaterialItem: { updateMany: vi.fn(async () => ({ count: updateCount })) },
    pemakaianMaterial: {
      create: vi.fn(async ({ data }: { data: any }) => ({
        id: 500,
        items: data.items.create.map((row: any, index: number) => ({
          id: 501 + index,
          itemId: row.itemId,
          jumlahDiterima: row.jumlahDiterima,
          hasilProduksiHarianItemId: row.hasilProduksiHarianItemId,
        })),
      })),
    },
    productionRoutingStage: {
      findMany: vi.fn(async (args: any) => {
        if (args?.where?.routingId !== undefined) {
          return siblingSequences.map((sequence) => ({ sequence }));
        }
        if (args?.where?.id !== undefined) {
          return routingStages.filter((row) => row.id === args.where.id);
        }
        return routingStages;
      }),
    },
    productionWorkOrder: { findUnique: vi.fn(async () => workOrderFixture) },
    hasilProduksiPemakaian: { create: vi.fn().mockResolvedValue({}) },
    barang: { updateMany: vi.fn().mockResolvedValue({ count: generatedUnitIds.length }) },
    hasilProduksiHarian: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: any }) => ({
        id: 10,
        nomor: data.nomor,
        tanggalProduksi: data.tanggalProduksi,
        divisiId: data.divisiId,
        routingStageId: data.routingStageId,
        bomId: data.bomId,
        bom: data.bomId ? { id: data.bomId, version: "1" } : null,
        routingStage: { id: data.routingStageId, stage: "BUFFING", sequence: 0 },
        divisi: { id: 1, nama: "Buffing" },
        items: data.items.create.map((row: any) => ({
          id: 100 + urut++,
          ...row,
          item: item(row.itemId),
          productVariant: row.productVariantId ? { id: row.productVariantId } : null,
          stokMutasi: null,
          barangDihasilkan: [],
        })),
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 10,
        nomor: "HP-20261022-0001",
        tanggalProduksi: new Date("2026-10-21T17:00:00.000Z"),
        divisi: { id: 1, nama: "Buffing" },
        items: [],
      })),
    },
  };
}

const permintaanOtomatis = {
  id: 9,
  noPermintaan: "PR-20261022-0009",
  approval: "BELUM_DISETUJUI",
  items: [],
};

function stage(overrides: Partial<StageFixture> = {}): StageFixture {
  return {
    id: 5,
    routingId: 1,
    sequence: 0,
    divisiId: 1,
    stage: "BUFFING",
    inputItems: [{ itemId: 1 }],
    outputItems: [{ itemId: 2 }, { itemId: 4 }],
    routing: { id: 1, isActive: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  wipRowsByItem = new Map([[1, [{ id: 10, jumlahSisa: 100, jumlahDipakai: 0 }]]]);
  routingStages = [stage()];
  siblingSequences = [0];
  workOrderFixture = null;
  updateCount = 1;
  generatedUnitIds = [1001, 1002];

  stokMock.lockItem.mockResolvedValue(undefined);
  inventoryMock.ensureDivisionInventoryLocation.mockResolvedValue({ id: 3, isActive: true });
  inventoryMock.getItemStockAtLocation.mockResolvedValue(1_000);
  inventoryMock.postInventoryMovementInTransaction.mockResolvedValue({});
  barangMock.generateBarangBulkInTransaction.mockResolvedValue({
    totalDibuat: 2,
    batches: [{ kodeBatch: "BC001", batchId: 1, jumlah: 2, barang: generatedUnitIds.map((id) => ({ id, kodeBarang: `BC-${id}` })) }],
  });
  bomMock.resolveEffectiveBomForVariant.mockResolvedValue({ id: 77, version: "1" });
  permintaanMock.createPermintaan.mockResolvedValue(permintaanOtomatis);
  prismaMock.hasilProduksiHarian.findUnique.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: (client: any) => unknown) => {
    tx = buatTx();
    return fn(tx);
  });
});

describe("createHasilProduksi (HP kanonik)", () => {
  it("mengonsumsi beberapa input dari lot WIP masing-masing dan mencatat beberapa hasil", async () => {
    routingStages = [stage({ inputItems: [{ itemId: 1 }, { itemId: 3 }] })];
    wipRowsByItem = new Map([
      [1, [{ id: 10, jumlahSisa: 10, jumlahDipakai: 0 }]],
      [3, [{ id: 30, jumlahSisa: 10, jumlahDipakai: 0 }]],
    ]);

    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 3, tipe: "MASUK", jumlah: 4 },
        { itemId: 2, tipe: "HASIL", jumlah: 4 },
        { itemId: 4, tipe: "HASIL", jumlah: 4 },
      ],
    });

    expect(tx.hasilProduksiHarian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 5 }),
              expect.objectContaining({ itemId: 3, tipe: "MASUK", jumlah: 4 }),
              expect.objectContaining({ itemId: 2, tipe: "HASIL", jumlah: 4, productVariantId: null }),
            ]),
          },
        }),
      }),
    );
    expect(tx.pemakaianMaterialItem.updateMany.mock.calls.map((call) => call[0].where.id)).toEqual([10, 30]);
    expect(tx.hasilProduksiPemakaian.create.mock.calls.map((call) => call[0].data)).toEqual([
      { hasilProduksiHarianItemId: 101, pemakaianMaterialItemId: 10, jumlah: 5 },
      { hasilProduksiHarianItemId: 102, pemakaianMaterialItemId: 30, jumlah: 4 },
    ]);
  });

  it("mengikat hasil produksi ke work order dan menyimpan routingStageId", async () => {
    workOrderFixture = {
      id: 7,
      orderId: 55,
      routingStageId: 5,
      status: "IN_PROGRESS",
      routingStage: { id: 5, divisiId: 1, inputItems: [{ itemId: 1 }], outputItems: [{ itemId: 2 }] },
    };

    await createHasilProduksi({
      divisiId: 1,
      productionWorkOrderId: 7,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 4 },
      ],
    });

    expect(tx.hasilProduksiHarian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 55,
          productionWorkOrderId: 7,
          routingStageId: 5,
        }),
      }),
    );
    expect(tx.productionRoutingStage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 5 }) }),
    );
  });

  it("HASIL SM membuat lot WIP dan satu movement masuk; tidak ada ledger L1", async () => {
    await createHasilProduksi(
      {
        divisiId: 1,
        tanggalProduksi: new Date("2026-10-22T00:00:00+07:00"),
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 50 },
          { itemId: 2, tipe: "HASIL", jumlah: 45 },
        ],
      },
      42,
    );

    expect(tx.pemakaianMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nomor: "WIP-HP-20261022-0001",
        sumber: "HASIL_PRODUKSI",
        hasilProduksiHarianId: 10,
        items: {
          create: [
            expect.objectContaining({
              itemId: 2,
              jumlahDiterima: 45,
              jumlahDipakai: 0,
              jumlahSisa: 45,
            }),
          ],
        },
      }),
      select: expect.any(Object),
    });
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 2,
        pemakaianMaterialItemId: 501,
        toLocationId: 3,
        type: "PRODUCTION",
        quantity: 45,
        hasilProduksiHarianItemId: 102,
      }),
    );
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 1,
        pemakaianMaterialItemId: 10,
        fromLocationId: 3,
        type: "PRODUCTION",
        quantity: 50,
        sourceType: "PRODUCTION_CONSUMPTION",
      }),
    );
  });

  it("HASIL non-SM mencatat movement masuk stok item", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 4, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(tx.pemakaianMaterial.create).not.toHaveBeenCalled();
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 4,
        toLocationId: 3,
        type: "PRODUCTION",
        quantity: 5,
        sourceType: "PRODUCTION_ITEM",
      }),
    );
  });

  it("output varian tahap akhir: lot sisa 0, unit Barang dibuat & ditautkan, tanpa stok item ganda", async () => {
    routingStages = [
      stage({ stage: "ASSEMBLY", inputItems: [{ itemId: 1 }], outputItems: [{ itemId: 2 }] }),
    ];

    const result = await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 2 },
        { itemId: 2, tipe: "HASIL", jumlah: 2, productVariantId: 2 },
      ],
      idempotencyKey: "hp-variant-0001",
    });

    expect(result.id).toBe(10);
    // Lot output dibuat dengan sisa 0 karena langsung dikonversi menjadi unit.
    expect(tx.pemakaianMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        items: {
          create: [
            expect.objectContaining({ itemId: 2, jumlahDiterima: 2, jumlahDipakai: 2, jumlahSisa: 0 }),
          ],
        },
      }),
      select: expect.any(Object),
    });
    expect(barangMock.generateBarangBulkInTransaction).toHaveBeenCalledWith(tx, 2, 2, expect.any(Date));
    expect(tx.barang.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1001, 1002] } },
      data: { hasilProduksiHarianItemId: 102 },
    });
    // Tidak ada movement stok ITEM untuk baris varian; hanya movement per unit.
    const itemMovements = inventoryMock.postInventoryMovementInTransaction.mock.calls.filter(
      (call) => call[1].itemId === 2,
    );
    expect(itemMovements).toHaveLength(0);
    const unitMovements = inventoryMock.postInventoryMovementInTransaction.mock.calls.filter(
      (call) => call[1].barangId !== undefined,
    );
    expect(unitMovements).toHaveLength(2);
    expect(unitMovements[0][1]).toMatchObject({
      barangId: 1001,
      toLocationId: 3,
      type: "PRODUCTION",
      quantity: 1,
      sourceType: "PRODUCTION_OUTPUT_UNIT",
      hasilProduksiHarianItemId: 102,
    });
    // BOM dibekukan pada header.
    expect(tx.hasilProduksiHarian.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bomId: 77 }) }),
    );
  });

  it("output varian tahap perakitan tanpa itemId: unit Barang dibuat dari ProductVariant", async () => {
    routingStages = [
      stage({ stage: "PERAKITAN", inputItems: [{ itemId: 1 }], outputItems: [] }),
    ];

    const result = await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 2 },
        { tipe: "HASIL", jumlah: 2, productVariantId: 2 },
      ],
      idempotencyKey: "hp-perakitan-variant-0001",
    });

    expect(result.id).toBe(10);
    expect(barangMock.generateBarangBulkInTransaction).toHaveBeenCalledWith(tx, 2, 2, expect.any(Date));
    expect(tx.barang.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1001, 1002] } },
      data: { hasilProduksiHarianItemId: 102 },
    });
  });

  it("menolak output varian pada tahap yang bukan terakhir", async () => {
    routingStages = [
      stage({ sequence: 0, outputItems: [{ itemId: 2 }] }),
      stage({ id: 6, sequence: 1, outputItems: [{ itemId: 4 }] }),
    ];
    siblingSequences = [0, 1];

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 2 },
          { itemId: 2, tipe: "HASIL", jumlah: 2, productVariantId: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: INPUT_TIDAK_VALID });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
  });

  it("menolak posting bila routing divisi belum dikonfigurasi", async () => {
    routingStages = [];

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 2 },
          { itemId: 2, tipe: "HASIL", jumlah: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "ROUTING_INVALID" });
    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
  });

  it("mengembalikan dokumen yang sama untuk idempotencyKey yang sama", async () => {
    prismaMock.hasilProduksiHarian.findUnique.mockResolvedValue({
      id: 10,
      divisiId: 1,
      tanggalProduksi: new Date("2026-10-21T17:00:00.000Z"),
      bomId: null,
      routingStageId: 5,
      items: [
        { itemId: 1, productVariantId: null, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, productVariantId: null, tipe: "HASIL", jumlah: 2 },
      ],
      divisi: { id: 1, nama: "Buffing" },
    });

    const result = await createHasilProduksi({
      divisiId: 1,
      tanggalProduksi: new Date("2026-10-22T00:00:00+07:00"),
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 2 },
      ],
      idempotencyKey: "hp-same-key-1",
    });

    expect(result.id).toBe(10);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("menolak idempotencyKey sama dengan payload berbeda", async () => {
    prismaMock.hasilProduksiHarian.findUnique.mockResolvedValue({
      id: 10,
      divisiId: 1,
      tanggalProduksi: new Date("2026-10-21T17:00:00.000Z"),
      bomId: null,
      routingStageId: 5,
      items: [
        { itemId: 1, productVariantId: null, tipe: "MASUK", jumlah: 99 },
        { itemId: 2, productVariantId: null, tipe: "HASIL", jumlah: 2 },
      ],
      divisi: { id: 1, nama: "Buffing" },
    });

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 2 },
        ],
        idempotencyKey: "hp-same-key-2",
      }),
    ).rejects.toMatchObject({ code: IDEMPOTENCY_CONFLICT });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("WIP kurang: tidak menyimpan header dan membuat permintaan otomatis (non-SM)", async () => {
    wipRowsByItem = new Map([[1, [{ id: 10, jumlahSisa: 3, jumlahDipakai: 0 }]]]);

    await expect(
      createHasilProduksi(
        {
          divisiId: 1,
          tanggalProduksi: new Date("2026-10-22T00:00:00+07:00"),
          items: [
            { itemId: 1, tipe: "MASUK", jumlah: 5 },
            { itemId: 2, tipe: "HASIL", jumlah: 4 },
          ],
        },
        42,
      ),
    ).rejects.toMatchObject({
      code: "WIP_KURANG",
      dataKekurangan: { divisiId: 1, itemId: 1, jumlahMasuk: 5, wipTersedia: 3, kekurangan: 2 },
      permintaanBarang: permintaanOtomatis,
    });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
    expect(tx.pemakaianMaterialItem.updateMany).not.toHaveBeenCalled();
    expect(permintaanMock.createPermintaan).toHaveBeenCalledWith(
      expect.objectContaining({
        tanggal: new Date("2026-10-21T17:00:00.000Z"),
        departemen: "Buffing",
        divisiPemintaId: 1,
        divisiApproverId: 1,
        namaPeminta: "Budi",
        sumber: "HASIL_PRODUKSI",
        autoKey: "HP:1:1:1:2026-10-22",
      }),
    );
  });

  it("request otomatis gagal tetap tidak menyimpan produksi dan membawa pesan jelas", async () => {
    wipRowsByItem = new Map();
    permintaanMock.createPermintaan.mockRejectedValue(new Error("gudang menolak"));

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 4 },
        ],
      }),
    ).rejects.toMatchObject({ code: "WIP_KURANG", permintaanBarang: null, permintaanError: "gudang menolak" });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
  });

  it("menerima jumlah hasil yang tidak sebanding dengan jumlah input", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 4 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(tx.pemakaianMaterialItem.updateMany).toHaveBeenCalledWith({
      where: { id: 10, jumlahSisa: { gte: 4 } },
      data: { jumlahSisa: { decrement: 4 }, jumlahDipakai: { increment: 4 } },
    });
  });

  it("menolak tanpa input, tanpa output, atau item MASUK+KELUAR sekaligus", async () => {
    await expect(
      createHasilProduksi({ divisiId: 1, items: [{ itemId: 2, tipe: "HASIL", jumlah: 5 }] }),
    ).rejects.toBeInstanceOf(HasilProduksiError);
    await expect(
      createHasilProduksi({ divisiId: 1, items: [{ itemId: 1, tipe: "MASUK", jumlah: 5 }] }),
    ).rejects.toBeInstanceOf(HasilProduksiError);
    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 4 },
          { itemId: 2, tipe: "HASIL", jumlah: 2 },
          { itemId: 1, tipe: "KELUAR", jumlah: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: INPUT_TIDAK_VALID });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("mengunci item sebelum membaca WIP", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(stokMock.lockItem).toHaveBeenCalledWith(expect.anything(), 1);
    expect(stokMock.lockItem.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain("FOR UPDATE");
  });

  it("gagal jika saldo WIP berubah saat update", async () => {
    updateCount = 0;

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 5 },
        ],
      }),
    ).rejects.toThrow("berubah saat produksi disimpan");

    expect(tx.hasilProduksiPemakaian.create).not.toHaveBeenCalled();
  });

  it("menolak KELUAR jika saldo lokasi divisi tidak cukup", async () => {
    inventoryMock.getItemStockAtLocation.mockResolvedValue(1);

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 4 },
          { itemId: 3, tipe: "KELUAR", jumlah: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "STOK_KURANG" });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
  });

  it("mengulang nomor otomatis saat P2002 nomor", async () => {
    let percobaan = 0;
    prismaMock.$transaction.mockImplementation(async (fn: (client: any) => unknown) => {
      percobaan += 1;
      if (percobaan === 1) {
        throw Object.assign(new Error("duplicate"), { code: "P2002", meta: { target: ["nomor"] } });
      }
      tx = buatTx();
      return fn(tx);
    });

    const hasil = await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(hasil.id).toBe(10);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("tidak mengulang nomor manual yang duplikat", async () => {
    prismaMock.$transaction.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "P2002", meta: { target: ["nomor"] } }),
    );

    await expect(
      createHasilProduksi({
        nomor: "HP-20261022-0001",
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 5 },
        ],
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
