import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({ default: {} }));
vi.mock("../src/model/inventory/inventory.js", () => ({
  postInventoryMovementInTransaction: vi.fn(),
}));

import { calculateWipStocktakeDifference } from "../src/model/quality/wipFlow.js";

describe("WIP stocktake difference", () => {
  it("computes gain, loss, and zero without changing ledger values", () => {
    expect(calculateWipStocktakeDifference(95, 100)).toBe(5);
    expect(calculateWipStocktakeDifference(100, 95)).toBe(-5);
    expect(calculateWipStocktakeDifference(95, 95)).toBe(0);
  });

  it("rounds to the ledger's six-decimal precision", () => {
    expect(calculateWipStocktakeDifference(4.123456, 4.123457)).toBe(0.000001);
  });

  it("rejects negative or non-finite quantities", () => {
    expect(() => calculateWipStocktakeDifference(-1, 0)).toThrowError(/non-negatif/);
    expect(() => calculateWipStocktakeDifference(1, Number.NaN)).toThrowError(/non-negatif/);
  });
});
