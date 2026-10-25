import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import {
  createQualityInspection,
  createRepairAttempt,
  QualityError,
} from "../src/model/quality/quality.js";

describe("createQualityInspection validation", () => {
  it("menolak pembagian hasil QC yang tidak sama dengan jumlah yang diperiksa", async () => {
    await expect(createQualityInspection({
      lines: [{
        pemakaianMaterialItemId: 5,
        productVariantId: 3,
        inspectedQuantity: 10,
        passedQuantity: 8,
        repairQuantity: 1,
        rejectedQuantity: 0,
      }],
    }, 7)).rejects.toMatchObject({
      name: "QualityError",
      code: "INPUT_INVALID",
    } satisfies Partial<QualityError>);
  });

  it("mewajibkan varian untuk hasil QC yang lolos", async () => {
    await expect(createQualityInspection({
      lines: [{
        pemakaianMaterialItemId: 5,
        inspectedQuantity: 1,
        passedQuantity: 1,
        repairQuantity: 0,
        rejectedQuantity: 0,
      }],
    }, 7)).rejects.toMatchObject({
      code: "VARIANT_REQUIRED",
    });
  });

  it("mewajibkan defect dengan divisi repair untuk jumlah repair", async () => {
    await expect(createQualityInspection({
      lines: [{
        pemakaianMaterialItemId: 5,
        productVariantId: 3,
        inspectedQuantity: 2,
        passedQuantity: 1,
        repairQuantity: 1,
        rejectedQuantity: 0,
        defects: [{
          description: "Perlu perbaikan",
          quantity: 1,
        }],
      }],
    }, 7)).rejects.toMatchObject({
      code: "DEFECT_ASSIGNMENT_REQUIRED",
    });
  });

  it("menolak kuantitas defect pecahan yang tidak dapat dihitung sebagai unit repair", async () => {
    await expect(createQualityInspection({
      lines: [{
        pemakaianMaterialItemId: 5,
        inspectedQuantity: 2,
        passedQuantity: 0,
        repairQuantity: 2,
        rejectedQuantity: 0,
        defects: [{
          description: "Perlu perbaikan",
          quantity: 1.5,
          repairDivisionId: 3,
        }],
      }],
    }, 7)).rejects.toMatchObject({
      code: "INPUT_INVALID",
    });
  });
});

describe("createRepairAttempt validation and division scope", () => {
  it("menolak jumlah repair yang bukan bilangan bulat sebelum mengakses database", async () => {
    await expect(createRepairAttempt(
      9,
      { quantityAttempted: 2.5, quantityRepaired: 2 },
      7,
      3,
    )).rejects.toMatchObject({
      name: "QualityError",
      code: "INPUT_INVALID",
    } satisfies Partial<QualityError>);
  });

  it("membatasi petugas ke divisi penugasan sebelum menyimpan attempt", async () => {
    const txMock = {
      $queryRaw: vi.fn(),
      repairAssignment: {
        findUnique: vi.fn(async () => ({
          id: 9,
          status: "ASSIGNED",
          repairDivisionId: 3,
          quantity: 4,
          attempts: [],
        })),
      },
    };
    Object.assign(prismaMock, {
      $transaction: vi.fn(async (operation: (tx: typeof txMock) => Promise<unknown>) => operation(txMock)),
    });

    await expect(createRepairAttempt(
      9,
      { quantityAttempted: 2, quantityRepaired: 1 },
      7,
      4,
    )).rejects.toMatchObject({
      name: "QualityError",
      code: "REPAIR_SCOPE_DENIED",
    } satisfies Partial<QualityError>);
  });
});
