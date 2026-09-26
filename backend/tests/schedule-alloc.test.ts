import { describe, it, expect, vi, beforeEach } from "vitest";

// Prisma client yang di-generate tak bisa diparse vitest langsung; modul ini
// hanya memakai namespace Prisma di dalam fungsi yang tidak diuji di sini.
vi.mock("../generated/prisma/client.js", () => ({ Prisma: {} }));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    productionOrder: { findUnique: vi.fn() },
    productionScheduleAllocEdit: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../src/lib/prisma.js";
import { saveScheduleAllocEdit } from "../src/model/production-order/production-order.js";

const orderFind = vi.mocked(prisma.productionOrder.findUnique);
const allocFind = vi.mocked(prisma.productionScheduleAllocEdit.findUnique);
const allocAgg = vi.mocked(prisma.productionScheduleAllocEdit.aggregate);
const allocUpsert = vi.mocked(prisma.productionScheduleAllocEdit.upsert);
const allocDelete = vi.mocked(prisma.productionScheduleAllocEdit.deleteMany);
const allocList = vi.mocked(prisma.productionScheduleAllocEdit.findMany);

const DAY = new Date("2026-10-05T00:00:00");

beforeEach(() => {
  vi.clearAllMocks();
  orderFind.mockResolvedValue({ id: 1, items: [{ variantId: 1, qty: 100 }] } as never);
  allocList.mockResolvedValue([] as never);
});

describe("saveScheduleAllocEdit mode", () => {
  it("set: menimpa pin hari itu", async () => {
    allocAgg.mockResolvedValue({ _sum: { qty: 40 } } as never);
    await saveScheduleAllocEdit(1, DAY, 1, 50, "set");
    expect(allocFind).not.toHaveBeenCalled();
    expect(allocUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ qty: 50 }), update: { qty: 50 } }),
    );
  });

  it("add: menjumlah ke pin hari itu", async () => {
    allocFind.mockResolvedValue({ qty: 30 } as never);
    allocAgg.mockResolvedValue({ _sum: { qty: 40 } } as never);
    await saveScheduleAllocEdit(1, DAY, 1, 20, "add");
    // next = 30 + 20 = 50; total = 40 (tanggal lain) + 50 = 90 <= 100
    expect(allocUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ qty: 50 }), update: { qty: 50 } }),
    );
  });

  it("over-allocation dilempar 409 tanpa menulis", async () => {
    allocFind.mockResolvedValue({ qty: 30 } as never);
    allocAgg.mockResolvedValue({ _sum: { qty: 60 } } as never);
    // next = 50; total = 60 + 50 = 110 > 100
    await expect(saveScheduleAllocEdit(1, DAY, 1, 20, "add")).rejects.toMatchObject({
      code: "E409",
      message: "Total alokasi 110 melebihi qty master 100",
    });
    expect(allocUpsert).not.toHaveBeenCalled();
  });

  it("qty null menghapus pin hari itu", async () => {
    await saveScheduleAllocEdit(1, DAY, 1, null, "add");
    expect(allocDelete).toHaveBeenCalled();
    expect(allocUpsert).not.toHaveBeenCalled();
  });

  it("variant di luar order ditolak 404", async () => {
    await expect(saveScheduleAllocEdit(1, DAY, 999, 1, "set")).rejects.toMatchObject({ code: "P2003" });
    expect(allocUpsert).not.toHaveBeenCalled();
  });
});
