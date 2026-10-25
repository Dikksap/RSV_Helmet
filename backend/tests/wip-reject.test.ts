import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import {
  claimWipReject,
  createWipReject,
  createWipRejectRepairAttempt,
  WipRejectError,
} from "../src/model/quality/wipReject.js";

describe("QC Akhir reject validation", () => {
  it("rejects invalid input before opening a database transaction", async () => {
    const transaction = vi.fn();
    Object.assign(prismaMock, { $transaction: transaction });

    await expect(createWipReject({
      itemId: 0,
      quantity: 1,
      reasonId: 2,
      repairDivisionId: 3,
      recordedById: 4,
    })).rejects.toMatchObject({
      name: "WipRejectError",
      code: "INVALID_INPUT",
    } satisfies Partial<WipRejectError>);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not allow repair quantity to exceed inspected quantity", async () => {
    const transaction = vi.fn();
    Object.assign(prismaMock, { $transaction: transaction });

    await expect(createWipRejectRepairAttempt({
      rejectId: 1,
      userId: 4,
      divisionId: 3,
      quantityAttempted: 2,
      quantityRepaired: 3,
    })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("prevents a repair division from claiming another division's reject", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      wipReject: {
        findUnique: vi.fn(async () => ({
          id: 1,
          repairDivisionId: 3,
          status: "OPEN",
          claimedById: null,
        })),
        update: vi.fn(),
      },
    };
    Object.assign(prismaMock, {
      $transaction: vi.fn(async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx)),
    });

    await expect(claimWipReject(1, 7, 9)).rejects.toMatchObject({
      name: "WipRejectError",
      code: "SCOPE_DENIED",
    });

    expect(tx.wipReject.update).not.toHaveBeenCalled();
  });
});
