import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/middleware/auth.js", () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (_req: any, _res: any, next: any) => next(),
  requirePermission: (..._permissions: string[]) =>
    (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../src/controller/quality/quality.js", () => {
  const noContent = (_req: any, res: any) => res.sendStatus(204);
  return {
    claimWipRejectHandler: noContent,
    createWipRejectHandler: noContent,
    createWipRejectReasonHandler: noContent,
    createWipRejectRepairAttemptHandler: noContent,
    listWipRejectOptionsHandler: noContent,
    listWipRejectReasonsHandler: noContent,
    listWipRejectsHandler: noContent,
    reviewWipRejectRepairHandler: noContent,
  };
});

import qualityRouter from "../src/routes/quality.js";

const app = express();
app.use(express.json());
app.use("/api/quality", qualityRouter);

describe("retired ERP quality endpoints", () => {
  it.each([
    ["GET", "/api/quality/daily-report"],
    ["POST", "/api/quality/final-inspections"],
    ["GET", "/api/quality/wip-flow"],
    ["GET", "/api/quality/wip-stocktake/options"],
    ["GET", "/api/quality/wip-stocktake"],
    ["POST", "/api/quality/wip-stocktake"],
    ["GET", "/api/quality/variants"],
    ["GET", "/api/quality/routings"],
    ["PUT", "/api/quality/routings"],
  ])("does not expose retired endpoint %s %s", async (method, path) => {
    const response = method === "GET" ? await request(app).get(path)
      : method === "POST" ? await request(app).post(path)
        : await request(app).put(path);
    expect(response.status).toBe(404);
  });
});
