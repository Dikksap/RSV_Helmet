import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/middleware/auth.js", () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (_req: any, _res: any, next: any) => next(),
  requirePermission: (..._permissions: string[]) =>
    (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../src/controller/inventory/inventory.js", () => ({
  getInventoryBalancesHandler: (_req: any, res: any) => res.json([]),
  getInventoryItemSummaryHandler: (_req: any, res: any) => res.json({ ringkasan: {} }),
  getInventoryItemTotalsHandler: (_req: any, res: any) => res.json({ stok: {} }),
  getInventoryLocationsHandler: (_req: any, res: any) => res.json([]),
  getInventoryMovementsHandler: (_req: any, res: any) => res.json([]),
  listUnmappedLegacyItemsHandler: (_req: any, res: any) => res.json([]),
  mapDivisionLocationHandler: (_req: any, res: any) => res.sendStatus(201),
  mapWarehouseLocationHandler: (_req: any, res: any) => res.sendStatus(201),
  listStockAdjustmentsHandler: (_req: any, res: any) => res.json([{ id: 8, status: "PENDING" }]),
  postInventoryMovementHandler: (_req: any, res: any) => res.sendStatus(201),
  requestStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(201),
  approveStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(200),
  rejectStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(200),
  setItemDefaultLocationHandler: (_req: any, res: any) => res.sendStatus(200),
}));

import inventoryRouter from "../src/routes/inventory.js";

const app = express();
app.use(express.json());
app.use("/api/inventory", inventoryRouter);

describe("inventory API", () => {
  it("keeps listing and approval actions", async () => {
    const list = await request(app).get("/api/inventory/adjustments");
    const approve = await request(app).post("/api/inventory/adjustments/8/approve");
    const reject = await request(app).post("/api/inventory/adjustments/8/reject");

    expect(list.status).toBe(200);
    expect(list.body).toEqual([{ id: 8, status: "PENDING" }]);
    expect(approve.status).toBe(200);
    expect(reject.status).toBe(200);
  });

  it("exposes ledger and legacy mapping endpoints", async () => {
    const locations = await request(app).get("/api/inventory/locations");
    const balances = await request(app).get("/api/inventory/balances");
    const movements = await request(app).get("/api/inventory/movements");
    const postMovement = await request(app).post("/api/inventory/movements");
    const itemSummary = await request(app).post("/api/inventory/items/summary").send({ ids: [1] });
    const itemTotals = await request(app).post("/api/inventory/items/totals").send({ ids: [1] });
    const unmapped = await request(app).get("/api/inventory/items/unmapped-legacy");
    const setDefault = await request(app).put("/api/inventory/items/1/default-location");

    expect(locations.status).toBe(200);
    expect(balances.status).toBe(200);
    expect(movements.status).toBe(200);
    expect(postMovement.status).toBe(201);
    expect(itemSummary.status).toBe(200);
    expect(itemTotals.status).toBe(200);
    expect(unmapped.status).toBe(200);
    expect(setDefault.status).toBe(200);
  });
});
