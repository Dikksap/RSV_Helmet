import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeaders: () => ({ Authorization: "Bearer test" }),
  redirectToLogin: vi.fn(),
}));

import { reverseInventoryMovement, saveProductionRouting } from "./erp";

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

describe("reverseInventoryMovement", () => {
  it("POST ke endpoint reversal dengan alasan", async () => {
    const fetchMock = stubResponse({ id: 99, type: "REVERSAL" }, 201);

    await reverseInventoryMovement(5, "salah input transfer");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inventory/movements/5/reverse"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "salah input transfer" }),
      }),
    );
  });

  it("meneruskan pesan konflik dari server", async () => {
    stubResponse({ code: "MOVEMENT_HAS_DEPENDENCY", message: "Mutasi berasal dari transaksi produksi" }, 409);

    await expect(reverseInventoryMovement(5, "koreksi")).rejects.toThrow(
      "Mutasi berasal dari transaksi produksi",
    );
  });
});

describe("saveProductionRouting", () => {
  const stages = [
    { stage: "BUFFING", divisiId: 1, inputItemIds: [1], outputItemIds: [2] },
  ];

  it("mengirim routingId saat mengedit routing tertentu", async () => {
    const fetchMock = stubResponse({ id: 21, version: 4, stages: [] }, 201);

    await saveProductionRouting({ stages }, 7);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ stages, routingId: 7 });
  });

  it("tanpa routingId tetap kompatibel dengan perilaku lama", async () => {
    const fetchMock = stubResponse({ id: 22, version: 5, stages: [] }, 201);

    await saveProductionRouting({ stages });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ stages });
  });
});
