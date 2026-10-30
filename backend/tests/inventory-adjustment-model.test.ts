import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import {
  approveStockAdjustment,
  rejectStockAdjustment,
  requestStockAdjustment,
} from "../src/model/inventory/inventory.js";

function createTransactionMock() {
  const balances = new Map<string, { id: number; quantity: number }>();
  const adjustment = {
    id: 41,
    itemId: 7,
    locationId: 3,
    batchId: null,
    systemQuantity: 8,
    physicalQuantity: 11,
    difference: 3,
    reason: "Hasil hitung fisik",
    status: "PENDING",
    requestedById: 12,
    approvedById: null,
    reviewedById: null,
    movementId: null,
  };
  const tx = {
    $queryRaw: vi.fn(),
    item: {
      findUnique: vi.fn().mockResolvedValue({ id: 7 }),
    },
    inventoryLocation: {
      findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
      findMany: vi.fn().mockResolvedValue([{ id: 3, isActive: true }]),
    },
    stockBalance: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 8 } }),
      findUnique: vi.fn(({ where }: { where: { balanceKey: string } }) =>
        Promise.resolve(balances.get(where.balanceKey) ?? null),
      ),
      create: vi.fn(({ data }: { data: { balanceKey: string; quantity: number } }) => {
        const row = { id: balances.size + 1, quantity: data.quantity };
        balances.set(data.balanceKey, row);
        return Promise.resolve(row);
      }),
      findUniqueOrThrow: vi.fn(({ where }: { where: { balanceKey: string } }) => {
        const row = balances.get(where.balanceKey);
        if (!row) throw new Error("Missing balance");
        return Promise.resolve(row);
      }),
      update: vi.fn(({
        where,
        data,
      }: {
        where: { balanceKey: string };
        data: { quantity: { increment: number } };
      }) => {
        const row = balances.get(where.balanceKey);
        if (!row) throw new Error("Missing balance");
        row.quantity += data.quantity.increment;
        return Promise.resolve(row);
      }),
    },
    inventoryMovement: {
      findFirst: vi.fn().mockResolvedValue({ id: 30n }),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 52n }),
    },
    stockAdjustment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  };
  prismaMock.$transaction.mockImplementation(async (operation) => operation(tx));
  return { tx, adjustment, balances };
}

describe("StockAdjustment workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending request with a system snapshot and movement reference", async () => {
    const { tx } = createTransactionMock();
    tx.stockBalance.aggregate.mockResolvedValue({ _sum: { quantity: 8 } });
    tx.inventoryMovement.findFirst.mockResolvedValue({ id: 30n });
    tx.stockAdjustment.create.mockResolvedValue({
      id: 41,
      status: "PENDING",
      systemQuantity: 8,
      physicalQuantity: 11,
      difference: 3,
    });

    await expect(
      requestStockAdjustment({
        itemId: 7,
        locationId: 3,
        physicalQuantity: 11,
        reason: "Hasil hitung fisik",
        requestedById: 12,
      }),
    ).resolves.toMatchObject({ id: 41, status: "PENDING" });

    expect(tx.stockAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 7,
          locationId: 3,
          systemQuantity: 8,
          physicalQuantity: 11,
          difference: 3,
          snapshotMovementId: 30n,
          requestedById: 12,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("posts an approved difference once and updates the balance", async () => {
    const { tx, adjustment, balances } = createTransactionMock();
    tx.stockAdjustment.findUnique
      .mockResolvedValueOnce({ id: adjustment.id, locationId: adjustment.locationId })
      .mockResolvedValueOnce(adjustment);
    tx.stockAdjustment.update.mockResolvedValue({
      ...adjustment,
      status: "APPROVED",
      movementId: 52n,
    });
    tx.stockAdjustment.findUniqueOrThrow.mockResolvedValue({
      ...adjustment,
      status: "APPROVED",
      movementId: 52n,
    });

    const approved = await approveStockAdjustment(adjustment.id, 9);

    expect(approved).toMatchObject({ status: "APPROVED", movementId: 52n });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toLocationId: 3,
          fromLocationId: null,
          type: "ADJUSTMENT",
          quantity: 3,
          idempotencyKey: "stock-adjustment:41",
        }),
      }),
    );
    expect(tx.stockAdjustment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          approvedById: 9,
          reviewedById: 9,
          movementId: 52n,
        }),
      }),
    );
    expect(balances.get("I:7:0:0:3")?.quantity).toBe(3);
  });

  it("does not allow the requester to approve their own adjustment", async () => {
    const { tx, adjustment } = createTransactionMock();
    tx.stockAdjustment.findUnique
      .mockResolvedValueOnce({ id: adjustment.id, locationId: adjustment.locationId })
      .mockResolvedValueOnce(adjustment);

    await expect(
      approveStockAdjustment(adjustment.id, adjustment.requestedById),
    ).rejects.toMatchObject({ code: "ADJUSTMENT_SELF_APPROVAL" });
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("rejects a pending request with a reviewer and reason", async () => {
    const { tx, adjustment } = createTransactionMock();
    tx.stockAdjustment.findUnique.mockResolvedValue(adjustment);
    tx.stockAdjustment.update.mockResolvedValue({ ...adjustment, status: "REJECTED" });
    tx.stockAdjustment.findUniqueOrThrow.mockResolvedValue({
      ...adjustment,
      status: "REJECTED",
      reviewNotes: "Dokumen pendukung tidak lengkap",
    });

    await expect(
      rejectStockAdjustment(adjustment.id, 9, "Dokumen pendukung tidak lengkap"),
    ).resolves.toMatchObject({ status: "REJECTED" });
    expect(tx.stockAdjustment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          reviewedById: 9,
          reviewNotes: "Dokumen pendukung tidak lengkap",
        }),
      }),
    );
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
