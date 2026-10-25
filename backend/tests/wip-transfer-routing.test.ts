import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({ default: {} }));

import { isAllowedProductionStageTransfer } from "../src/model/wipTransfer/wipTransfer.js";

const stages = [
  { divisiId: 1, inputItemId: 10, outputItemId: 11 },
  { divisiId: 2, inputItemId: 11, outputItemId: 12 },
  { divisiId: 3, inputItemId: 12, outputItemId: 13 },
  { divisiId: 4, inputItemId: 13, outputItemId: 14 },
];

describe("production routing WIP transfer", () => {
  it("allows only the next stage for a routed process output", () => {
    expect(isAllowedProductionStageTransfer(stages, 1, 2, 11)).toBe(true);
    expect(isAllowedProductionStageTransfer(stages, 1, 3, 11)).toBe(false);
    expect(isAllowedProductionStageTransfer(stages, 2, 4, 12)).toBe(false);
  });

  it("does not constrain items that are not outputs in a routing", () => {
    expect(isAllowedProductionStageTransfer(stages, 8, 9, 99)).toBe(true);
  });
});
