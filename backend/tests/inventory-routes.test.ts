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
  listStockAdjustmentsHandler: (_req: any, res: any) => res.json([{ id: 8, status: "PENDING" }]),
  requestStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(201),
  approveStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(200),
  rejectStockAdjustmentHandler: (_req: any, res: any) => res.sendStatus(200),
}));

import inventoryRouter from "../src/routes/inventory.js";

const app = express();
app.use(express.json());
app.use("/api/inventory", inventoryRouter);

describe("inventory adjustment API retained for supervisor review", () => {
  it("keeps listing and approval actions", async () => {
    const list = await request(app).get("/api/inventory/adjustments");
    const approve = await request(app).post("/api/inventory/adjustments/8/approve");
    const reject = await request(app).post("/api/inventory/adjustments/8/reject");

    expect(list.status).toBe(200);
    expect(list.body).toEqual([{ id: 8, status: "PENDING" }]);
    expect(approve.status).toBe(200);
    expect(reject.status).toBe(200);
  });

  it.each([
    ["GET", "/api/inventory/locations"],
    ["GET", "/api/inventory/balances"],
    ["GET", "/api/inventory/movements"],
    ["POST", "/api/inventory/movements"],
  ])("does not expose retired ledger endpoint %s %s", async (method, path) => {
    const response = method === "GET" ? await request(app).get(path) : await request(app).post(path);
    expect(response.status).toBe(404);
  });
});
