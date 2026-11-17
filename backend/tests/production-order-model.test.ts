import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  productionOrderItem: { findMany: vi.fn() },
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { getFinishgoodCounts } from "../src/model/production-order/production-order.js";

describe("getFinishgoodCounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes custom barang statuses other than REGISTER", async () => {
    prismaMock.productionOrderItem.findMany.mockResolvedValue([{ variantId: 7 }]);
    prismaMock.$queryRaw.mockResolvedValue([
      { tanggal: new Date(2026, 10, 17), variantId: 7, qty: 1n },
    ]);

    await expect(
      getFinishgoodCounts(3, new Date(2026, 10, 17), new Date(2026, 10, 17)),
    ).resolves.toEqual([
      { tanggal: "2026-11-17", variantId: 7, qty: 1, reject: 0 },
    ]);

    const query = prismaMock.$queryRaw.mock.calls[0][0] as { sql: string };
    expect(query.sql).toContain("b.status <> 'REGISTER'");
    expect(query.sql).not.toContain("b.status IN");
  });
});
