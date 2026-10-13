import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  stokOpnameSesi: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  stokOpnameBaris: { create: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}));

vi.mock("../src/model/stokItem/stokItem.js", () => ({
  catatMutasi: vi.fn(),
  getSaldo: vi.fn(),
  lockItem: vi.fn(),
}));

import { buatSesiOpname } from "../src/model/stokOpname/stokOpname.js";
import { catatMutasi, getSaldo, lockItem } from "../src/model/stokItem/stokItem.js";

const mockedModel = {
  catatMutasi: vi.mocked(catatMutasi),
  getSaldo: vi.mocked(getSaldo),
  lockItem: vi.mocked(lockItem),
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.stokOpnameSesi.create.mockResolvedValue({ id: 9 });
  tx.stokOpnameSesi.findUniqueOrThrow.mockResolvedValue({ id: 9 });
  tx.stokOpnameBaris.create.mockImplementation(async (args: any) => ({ id: args.data.itemId * 10, ...args.data }));
  // sistem: item 1 -> 100, item 2 -> 5, item 3 -> 7
  mockedModel.getSaldo.mockImplementation(async (itemId: number) => ({ 1: 100, 2: 5, 3: 7 })[itemId] ?? 0);
});

describe("buatSesiOpname", () => {
  it("selisih + buat MASUK, selisih - buat KELUAR, selisih 0 tetap disimpan tanpa ledger", async () => {
    await buatSesiOpname(
      [
        { itemId: 1, stokFisik: 102 },
        { itemId: 2, stokFisik: 3 },
        { itemId: 3, stokFisik: 7 },
      ],
      null,
      4,
    );

    expect(tx.stokOpnameBaris.create).toHaveBeenCalledTimes(3);
    expect(tx.stokOpnameBaris.create).toHaveBeenCalledWith({
      data: { sesiId: 9, itemId: 1, stokSistem: 100, stokFisik: 102, selisih: 2 },
    });
    expect(tx.stokOpnameBaris.create).toHaveBeenCalledWith({
      data: { sesiId: 9, itemId: 3, stokSistem: 7, stokFisik: 7, selisih: 0 },
    });
    expect(mockedModel.catatMutasi).toHaveBeenCalledTimes(2);
    expect(mockedModel.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 2, sumberOpnameBarisId: 10, userId: 4 }),
    );
    expect(mockedModel.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 2, tipe: "KELUAR", jumlah: 2, sumberOpnameBarisId: 20 }),
    );
  });

  it("mengunci item terurut sebelum baca saldo", async () => {
    await buatSesiOpname(
      [
        { itemId: 2, stokFisik: 5 },
        { itemId: 1, stokFisik: 100 },
      ],
      "cek gudang",
      null,
    );

    expect(tx.stokOpnameSesi.create).toHaveBeenCalledWith({ data: { keterangan: "cek gudang", userId: null } });
    const lockIds = mockedModel.lockItem.mock.calls.map((c) => c[1]);
    expect(lockIds).toEqual([1, 2]);
  });
});
