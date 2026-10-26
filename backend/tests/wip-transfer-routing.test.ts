import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({ default: {} }));

import { isAllowedProductionStageTransfer } from "../src/model/wipTransfer/wipTransfer.js";

const stages = [
  { divisiId: 1, inputItemIds: [10], outputItemIds: [11, 15] },
  { divisiId: 2, inputItemIds: [11, 15], outputItemIds: [12, 16] },
  { divisiId: 3, inputItemIds: [12, 16], outputItemIds: [13] },
  { divisiId: 4, inputItemIds: [13], outputItemIds: [14] },
];

describe("production routing WIP transfer", () => {
  it("allows only the next stage for a routed process output", () => {
    expect(isAllowedProductionStageTransfer(stages, 1, 2, 15)).toBe(true);
    expect(isAllowedProductionStageTransfer(stages, 1, 3, 11)).toBe(false);
    expect(isAllowedProductionStageTransfer(stages, 2, 4, 16)).toBe(false);
  });

  it("does not constrain items that are not outputs in a routing", () => {
    expect(isAllowedProductionStageTransfer(stages, 8, 9, 99)).toBe(true);
  });
});
