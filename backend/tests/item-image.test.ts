import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/model/item/item.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/model/item/item.js")>();
  return {
    ...actual,
    listItems: vi.fn(),
    getItemById: vi.fn(),
    getItemImagePath: vi.fn(),
    setItemImagePath: vi.fn(),
  };
});

vi.mock("../src/middleware/auth.js", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 1 };
    next();
  },
  authorize: (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

import itemRouter from "../src/routes/item.js";
import { listItems } from "../src/model/item/item.js";

const mockedListItems = vi.mocked(listItems);
const app = express();
app.use(express.json());
app.use("/api/items", itemRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("item image API", () => {
  it("exposes a public image URL without leaking the stored file path", async () => {
    mockedListItems.mockResolvedValue([{
      id: 4,
      kode: "ITEM4",
      nama: "Item Empat",
      imagePath: "items/unique-image.webp",
      updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    }] as never);

    const response = await request(app).get("/api/items");

    expect(response.status).toBe(200);
    expect(response.body[0].imageUrl).toContain("/api/items/4/image");
    expect(response.body[0].imagePath).toBeUndefined();
  });

  it("rejects unsupported image MIME types before upload processing", async () => {
    const response = await request(app)
      .post("/api/items/4/image")
      .attach("image", Buffer.from("not an image"), {
        filename: "image.gif",
        contentType: "image/gif",
      });

    expect(response.status).toBe(415);
    expect(response.body.message).toContain("JPEG, PNG, atau WebP");
  });
});
