import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeaders: () => ({ Authorization: "Bearer test" }),
  redirectToLogin: vi.fn(),
}));

import {
  buildReportQuery,
  getFinishedGoodsSummary,
  getMaterialConsumption,
  getReconciliation,
  getTraceability,
  pesanLaporan,
  ReportApiError,
} from "./reports";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const filters = {
  from: "2026-11-01",
  to: "2026-11-30",
  productId: 1,
  variantId: null,
  divisiId: 3,
  status: "finishgood",
};

describe("buildReportQuery", () => {
  it("hanya menyertakan filter yang terisi dan menormalkan status", () => {
    const query = buildReportQuery(filters);
    expect(query.get("from")).toBe("2026-11-01");
    expect(query.get("to")).toBe("2026-11-30");
    expect(query.get("productId")).toBe("1");
    expect(query.get("divisiId")).toBe("3");
    expect(query.get("status")).toBe("FINISHGOOD");
    expect(query.get("variantId")).toBeNull();
  });
});

describe("endpoint laporan", () => {
  it("memanggil finished-goods summary dengan query", async () => {
    const fetchMock = stubResponse({ totals: {}, perVariant: [], warnings: [] });
    await getFinishedGoodsSummary(filters);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/reports\/finished-goods\/summary\?from=2026-11-01/),
      expect.any(Object),
    );
  });

  it("menambahkan basis pada laporan konsumsi material", async () => {
    const fetchMock = stubResponse({ rows: [], warnings: [] });
    await getMaterialConsumption(filters, "PRODUKSI");
    expect(fetchMock.mock.calls[0][0]).toContain("basis=PRODUKSI");
  });

  it("meneruskan kodeBarang pada traceability", async () => {
    const fetchMock = stubResponse({ rows: [], warnings: [] });
    await getTraceability({ ...filters, kodeBarang: "BC001-WB001-091126-0001" });
    expect(fetchMock.mock.calls[0][0]).toContain("kodeBarang=BC001-WB001-091126-0001");
  });

  it("memanggil rekonsiliasi", async () => {
    const fetchMock = stubResponse({ perVariant: [], wip: [], legacy: {}, warnings: [] });
    await getReconciliation(filters);
    expect(fetchMock.mock.calls[0][0]).toContain("/reports/reconciliation");
  });

  it("memetakan 403 menjadi pesan izin", async () => {
    stubResponse({ message: "Akses ditolak" }, 403);
    try {
      await getFinishedGoodsSummary(filters);
      throw new Error("harus gagal");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportApiError);
      expect((error as ReportApiError).status).toBe(403);
      expect(pesanLaporan(error)).toContain("tidak punya izin");
    }
  });
});
