import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/production-order/production-order.js", () => ({
  getAllOrders: vi.fn(),
  getOrderById: vi.fn(),
  getOrderSummary: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  deleteOrder: vi.fn(),
  addOrderItem: vi.fn(),
  updateOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  getCapacities: vi.fn(),
  replaceCapacities: vi.fn(),
  getRealisasi: vi.fn(),
  getFinishgoodCounts: vi.fn(),
  saveRealisasi: vi.fn(),
  getRealisasiStages: vi.fn(),
  saveRealisasiStages: vi.fn(),
  REALISASI_STAGES: ["persiapan", "decalSolid", "decalMotif", "topCoat", "perakitan", "qc"],
}));

import productionOrdersRouter from "../src/routes/production-orders.js";
import {
  getAllOrders,
  getOrderById,
  getOrderSummary,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  getCapacities,
  replaceCapacities,
  getRealisasi,
  getFinishgoodCounts,
  saveRealisasi,
  getRealisasiStages,
  saveRealisasiStages,
} from "../src/model/production-order/production-order.js";

const mocked = {
  getAllOrders: vi.mocked(getAllOrders),
  getOrderById: vi.mocked(getOrderById),
  getOrderSummary: vi.mocked(getOrderSummary),
  createOrder: vi.mocked(createOrder),
  updateOrder: vi.mocked(updateOrder),
  deleteOrder: vi.mocked(deleteOrder),
  addOrderItem: vi.mocked(addOrderItem),
  updateOrderItem: vi.mocked(updateOrderItem),
  deleteOrderItem: vi.mocked(deleteOrderItem),
  getCapacities: vi.mocked(getCapacities),
  replaceCapacities: vi.mocked(replaceCapacities),
  getRealisasi: vi.mocked(getRealisasi),
  getFinishgoodCounts: vi.mocked(getFinishgoodCounts),
  saveRealisasi: vi.mocked(saveRealisasi),
  getRealisasiStages: vi.mocked(getRealisasiStages),
  saveRealisasiStages: vi.mocked(saveRealisasiStages),
};

const app = express();
app.use(express.json());
app.use("/api/production-orders", productionOrdersRouter);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/production-orders", () => {
  it("200 list", async () => {
    mocked.getAllOrders.mockResolvedValue([{ id: 1, nomor: "PO-202610-001" }] as any);
    const res = await request(app).get("/api/production-orders");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/production-orders/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/production-orders/abc");
    expect(res.status).toBe(400);
  });
  it("404 tidak ditemukan", async () => {
    mocked.getOrderById.mockResolvedValue(null);
    const res = await request(app).get("/api/production-orders/99");
    expect(res.status).toBe(404);
  });
  it("200 + summary=1 pakai getOrderSummary", async () => {
    mocked.getOrderSummary.mockResolvedValue({ id: 1, ringkasan: [] } as any);
    const res = await request(app).get("/api/production-orders/1?summary=1");
    expect(res.status).toBe(200);
    expect(mocked.getOrderSummary).toHaveBeenCalledWith(1);
  });
});

describe("POST /api/production-orders", () => {
  it("400 tanpa nomor/periode", async () => {
    const res = await request(app).post("/api/production-orders").send({});
    expect(res.status).toBe(400);
  });
  it("400 status invalid", async () => {
    const res = await request(app)
      .post("/api/production-orders")
      .send({ nomor: "PO-1", periode: "2026-10", status: "SALAH" });
    expect(res.status).toBe(400);
  });
  it("400 item invalid", async () => {
    const res = await request(app)
      .post("/api/production-orders")
      .send({ nomor: "PO-1", periode: "2026-10", items: [{ variantId: 0, qty: -1 }] });
    expect(res.status).toBe(400);
  });
  it("201 sukses", async () => {
    mocked.createOrder.mockResolvedValue({ id: 1, nomor: "PO-202610-001" } as any);
    const res = await request(app).post("/api/production-orders").send({
      nomor: "PO-202610-001",
      periode: "2026-10",
      items: [{ variantId: 1, qty: 600, priority: 5 }],
    });
    expect(res.status).toBe(201);
    expect(mocked.createOrder).toHaveBeenCalled();
  });
  it("409 nomor duplikat", async () => {
    mocked.createOrder.mockRejectedValue({ code: "P2002" });
    const res = await request(app).post("/api/production-orders").send({ nomor: "PO-1", periode: "2026-10" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/production-orders/:id/items", () => {
  it("400 item invalid", async () => {
    const res = await request(app).post("/api/production-orders/1/items").send({ variantId: "x" });
    expect(res.status).toBe(400);
    expect(mocked.addOrderItem).not.toHaveBeenCalled();
  });
  it("201 sukses", async () => {
    mocked.addOrderItem.mockResolvedValue({ id: 10 } as any);
    const res = await request(app)
      .post("/api/production-orders/1/items")
      .send({ variantId: 1, qty: 600 });
    expect(res.status).toBe(201);
  });
  it("409 variant duplikat", async () => {
    mocked.addOrderItem.mockRejectedValue({ code: "P2002" });
    const res = await request(app)
      .post("/api/production-orders/1/items")
      .send({ variantId: 1, qty: 1 });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/production-orders/:id/capacities", () => {
  it("200 list", async () => {
    mocked.getCapacities.mockResolvedValue([{ id: 1, stage: "QC" }] as any);
    const res = await request(app).get("/api/production-orders/1/capacities");
    expect(res.status).toBe(200);
    expect(mocked.getCapacities).toHaveBeenCalledWith(1);
  });
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/production-orders/abc/capacities");
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/production-orders/:id/items/:itemId", () => {
  it("400 tanpa field", async () => {
    const res = await request(app).put("/api/production-orders/1/items/10").send({});
    expect(res.status).toBe(400);
    expect(mocked.updateOrderItem).not.toHaveBeenCalled();
  });
  it("400 qty negatif", async () => {
    const res = await request(app).put("/api/production-orders/1/items/10").send({ qty: -1 });
    expect(res.status).toBe(400);
  });
  it("200 sukses parsial", async () => {
    mocked.updateOrderItem.mockResolvedValue({ id: 10, qty: 600 } as any);
    const res = await request(app).put("/api/production-orders/1/items/10").send({ qty: 600 });
    expect(res.status).toBe(200);
    expect(mocked.updateOrderItem).toHaveBeenCalledWith(1, 10, { qty: 600, priority: undefined });
  });
  it("404 item hilang", async () => {
    mocked.updateOrderItem.mockRejectedValue({ code: "P2025" });
    const res = await request(app).put("/api/production-orders/1/items/99").send({ qty: 1 });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/production-orders/:id/schedule", () => {
  const order = {
    id: 1,
    nomor: "PO-202610-001",
    periode: "2026-10",
    totalQty: 10,
    items: [
      { variantId: 1, qty: 10, priority: 1, variant: { style: { nama: "Solid" }, color: { nama: "A" }, size: { nama: "MD", urutan: 2 } } },
    ],
  };
  const caps = [
    { stage: "PERSIAPAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-05" },
    { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-05" },
  ];
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/production-orders/abc/schedule");
    expect(res.status).toBe(400);
  });
  it("404 order hilang", async () => {
    mocked.getOrderById.mockResolvedValue(null);
    const res = await request(app).get("/api/production-orders/99/schedule");
    expect(res.status).toBe(404);
  });
  it("200 jadwal + meta konsisten", async () => {
    mocked.getOrderById.mockResolvedValue(order as any);
    mocked.getCapacities.mockResolvedValue(caps as any);
    const res = await request(app).get("/api/production-orders/1/schedule");
    expect(res.status).toBe(200);
    expect(res.body.meta.dialokasikan).toBe(10);
    expect(res.body.meta.sisa).toBe(0);
    expect(res.body.rows.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/production-orders/:id/capacities", () => {
  it("400 body bukan array", async () => {
    const res = await request(app).put("/api/production-orders/1/capacities").send({});
    expect(res.status).toBe(400);
    expect(mocked.replaceCapacities).not.toHaveBeenCalled();
  });
  it("400 item invalid", async () => {
    const res = await request(app)
      .put("/api/production-orders/1/capacities")
      .send([{ stage: "", kapasitasWeekday: -1 }]);
    expect(res.status).toBe(400);
    expect(mocked.replaceCapacities).not.toHaveBeenCalled();
  });
  it("200 sukses", async () => {
    mocked.replaceCapacities.mockResolvedValue([{ id: 1 }] as any);
    const res = await request(app)
      .put("/api/production-orders/1/capacities")
      .send([{ stage: "QC", kapasitasWeekday: 288, mulai: "2026-10-06" }]);
    expect(res.status).toBe(200);
    expect(mocked.replaceCapacities).toHaveBeenCalled();
  });
  it("404 order hilang", async () => {
    mocked.replaceCapacities.mockRejectedValue({ code: "P2025" });
    const res = await request(app)
      .put("/api/production-orders/1/capacities")
      .send([{ stage: "QC" }]);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/production-orders/:id/realisasi", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/production-orders/abc/realisasi");
    expect(res.status).toBe(400);
  });
  it("400 tanggal invalid", async () => {
    const res = await request(app).get("/api/production-orders/1/realisasi?awal=xx&akhir=2026-10-05");
    expect(res.status).toBe(400);
  });
  it("404 order hilang", async () => {
    mocked.getOrderById.mockResolvedValue(null);
    const res = await request(app).get("/api/production-orders/99/realisasi?awal=2026-10-05&akhir=2026-10-05");
    expect(res.status).toBe(404);
  });
  it("200 realisasi + finishgood", async () => {
    mocked.getOrderById.mockResolvedValue({ id: 1 } as any);
    mocked.getRealisasi.mockResolvedValue([{ tanggal: "2026-10-05", variantId: 1, qty: 100 }]);
    mocked.getFinishgoodCounts.mockResolvedValue([{ tanggal: "2026-10-05", variantId: 1, qty: 90 }]);
    const res = await request(app).get("/api/production-orders/1/realisasi?awal=2026-10-05&akhir=2026-10-05");
    expect(res.status).toBe(200);
    expect(res.body.realisasi).toHaveLength(1);
    expect(res.body.finishgood).toHaveLength(1);
  });
});

describe("PUT /api/production-orders/:id/realisasi", () => {
  const body = { tanggal: "2026-10-05", items: [{ variantId: 1, qty: 100 }] };
  it("400 tanggal invalid", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "xx", items: [] });
    expect(res.status).toBe(400);
  });
  it("400 items kosong", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "2026-10-05", items: [] });
    expect(res.status).toBe(400);
    expect(mocked.saveRealisasi).not.toHaveBeenCalled();
  });
  it("400 qty negatif", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "2026-10-05", items: [{ variantId: 1, qty: -1 }] });
    expect(res.status).toBe(400);
  });
  it("200 sukses", async () => {
    mocked.saveRealisasi.mockResolvedValue([{ tanggal: "2026-10-05", variantId: 1, qty: 100 }]);
    const res = await request(app).put("/api/production-orders/1/realisasi").send(body);
    expect(res.status).toBe(200);
    expect(mocked.saveRealisasi).toHaveBeenCalled();
  });
  it("404 order hilang", async () => {
    mocked.saveRealisasi.mockRejectedValue({ code: "P2025" });
    const res = await request(app).put("/api/production-orders/1/realisasi").send(body);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/production-orders/:id/realisasi tahapan", () => {
  const body = { tanggal: "2026-10-05", items: [{ variantId: 1, qty: 10 }], tahapan: [{ stage: "topCoat", qty: 200 }] };
  it("400 stage invalid", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ ...body, tahapan: [{ stage: "x", qty: 1 }] });
    expect(res.status).toBe(400);
    expect(mocked.saveRealisasi).not.toHaveBeenCalled();
  });
  it("400 tahapan bukan array", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ ...body, tahapan: {} });
    expect(res.status).toBe(400);
  });
  it("200 sukses + simpan tahapan", async () => {
    mocked.saveRealisasi.mockResolvedValue([{ tanggal: "2026-10-05", variantId: 1, qty: 10 }]);
    mocked.saveRealisasiStages.mockResolvedValue([{ tanggal: "2026-10-05", stage: "topCoat", qty: 200 }]);
    const res = await request(app).put("/api/production-orders/1/realisasi").send(body);
    expect(res.status).toBe(200);
    expect(res.body.tahapan).toHaveLength(1);
    expect(mocked.saveRealisasiStages).toHaveBeenCalled();
  });
});

describe("PUT /api/production-orders/:id/realisasi kunci tanggal", () => {
  it("400 tanggal lampau terkunci", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "2020-01-01", items: [{ variantId: 1, qty: 1 }] });
    expect(res.status).toBe(400);
    expect(mocked.saveRealisasi).not.toHaveBeenCalled();
  });
});

describe("PUT /api/production-orders/:id/realisasi reject", () => {
  it("400 reject negatif", async () => {
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "2026-10-05", items: [{ variantId: 1, qty: 1, reject: -1 }] });
    expect(res.status).toBe(400);
    expect(mocked.saveRealisasi).not.toHaveBeenCalled();
  });
  it("200 dengan reject diteruskan", async () => {
    mocked.saveRealisasi.mockResolvedValue([{ tanggal: "2026-10-05", variantId: 1, qty: 10, reject: 2 }]);
    const res = await request(app).put("/api/production-orders/1/realisasi").send({ tanggal: "2026-10-05", items: [{ variantId: 1, qty: 10, reject: 2 }] });
    expect(res.status).toBe(200);
    expect(mocked.saveRealisasi).toHaveBeenCalledWith(1, expect.any(Date), [{ variantId: 1, qty: 10, reject: 2 }]);
  });
  it("200 GET tanpa tanggal = semua", async () => {
    mocked.getOrderById.mockResolvedValue({ id: 1 } as any);
    mocked.getRealisasi.mockResolvedValue([]);
    mocked.getFinishgoodCounts.mockResolvedValue([]);
    mocked.getRealisasiStages.mockResolvedValue([]);
    const res = await request(app).get("/api/production-orders/1/realisasi");
    expect(res.status).toBe(200);
    expect(mocked.getRealisasi).toHaveBeenCalledWith(1, null, null);
  });
});

describe("PUT /api/production-orders/:id mulaiProduksi", () => {
  it("400 mulaiProduksi invalid", async () => {
    const res = await request(app).put("/api/production-orders/1").send({ mulaiProduksi: "xx" });
    expect(res.status).toBe(400);
    expect(mocked.updateOrder).not.toHaveBeenCalled();
  });
  it("200 sukses + null reset", async () => {
    mocked.updateOrder.mockResolvedValue({ id: 1, mulaiProduksi: "2026-10-06" } as any);
    const res = await request(app).put("/api/production-orders/1").send({ mulaiProduksi: "2026-10-06" });
    expect(res.status).toBe(200);
    expect(mocked.updateOrder).toHaveBeenCalledWith(1, expect.objectContaining({ mulaiProduksi: "2026-10-06" }));
    mocked.updateOrder.mockResolvedValue({ id: 1, mulaiProduksi: null } as any);
    const res2 = await request(app).put("/api/production-orders/1").send({ mulaiProduksi: null });
    expect(res2.status).toBe(200);
  });
});
