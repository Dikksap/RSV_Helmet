import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeaders: () => ({ Authorization: "Bearer test" }),
  redirectToLogin: vi.fn(),
}));

import {
  createHasilProduksi,
  HasilProduksiApiError,
  pesanHasilProduksi,
} from "./hasilProduksiHarian";
import { redirectToLogin } from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === null ? "" : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const payload = {
  divisiId: 3,
  routingStageId: 12,
  idempotencyKey: "hp-key-1",
  items: [
    { itemId: 10, tipe: "MASUK" as const, jumlah: 2 },
    { itemId: 20, tipe: "HASIL" as const, jumlah: 2, productVariantId: 7 },
  ],
};

describe("createHasilProduksi", () => {
  it("POST ke endpoint kanonik dengan payload JSON", async () => {
    const fetchMock = stubResponse({ id: 1, nomor: "HP-20261109-0001", items: [] });

    const result = await createHasilProduksi(payload);

    expect(result).toMatchObject({ id: 1, nomor: "HP-20261109-0001" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/hasil-produksi-harian"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("memetakan 409 WIP_KURANG ke error bertipe dengan data kekurangan", async () => {
    stubResponse(
      {
        code: "WIP_KURANG",
        message: "WIP Batok kurang",
        dataKekurangan: {
          itemId: 10,
          itemKode: "SM0025",
          itemNama: "Batok Buffing",
          unit: "pcs",
          jumlahMasuk: 5,
          wipTersedia: 3,
          kekurangan: 2,
        },
        saranTransfer: { divisiAsalId: 1, divisiAsalNama: "Buffing" },
        permintaanBarang: { id: 9, noPermintaan: "PR-20261109-0009" },
      },
      409,
    );

    let captured: unknown;
    try {
      await createHasilProduksi(payload);
      throw new Error("harus gagal");
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(HasilProduksiApiError);
    expect(captured).toMatchObject({
      status: 409,
      code: "WIP_KURANG",
      permintaanBarang: { id: 9, noPermintaan: "PR-20261109-0009" },
    });
    const message = pesanHasilProduksi(captured);
    expect(message).toContain("kurang");
    expect(message).toContain("SM0025");
  });

  it("menambahkan panduan pada kode routing/BOM yang dikenal", () => {
    const routing = new HasilProduksiApiError("tidak sesuai routing", 400, { code: "ROUTING_INVALID" });
    expect(pesanHasilProduksi(routing)).toContain("Routing Produksi");

    const bom = new HasilProduksiApiError("BOM tidak ditemukan", 400, { code: "BOM_NOT_FOUND" });
    expect(pesanHasilProduksi(bom)).toContain("Lengkapi BOM");

    const idem = new HasilProduksiApiError("payload berbeda", 409, { code: "IDEMPOTENCY_CONFLICT" });
    expect(pesanHasilProduksi(idem)).toContain("Muat ulang form");
  });

  it("401 memicu redirect login", async () => {
    stubResponse({ message: "Token tidak valid" }, 401);

    await expect(createHasilProduksi(payload)).rejects.toThrow("Sesi telah berakhir");
    expect(redirectToLogin).toHaveBeenCalled();
  });
});
