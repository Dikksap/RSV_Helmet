import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeaders: () => ({}),
  redirectToLogin: vi.fn(),
}));

import {
  deletePemakaianMaterial,
  PemakaianMaterialApiError,
  pesanKesalahanPemakaian,
} from "./pemakaianMaterial";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubResponse(body: unknown, status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("pemakaianMaterial API", () => {
  it("memetakan 409 PEMAKAIAN_DIPAKAI_PRODUKSI ke error bertipe", async () => {
    stubResponse(
      {
        kode: "PEMAKAIAN_DIPAKAI_PRODUKSI",
        message: "Pemakaian material sudah dipakai produksi dan tidak bisa dihapus",
      },
      409,
    );

    await expect(deletePemakaianMaterial(7)).rejects.toMatchObject({
      name: "PemakaianMaterialApiError",
      status: 409,
      kode: "PEMAKAIAN_DIPAKAI_PRODUKSI",
    });
  });

  it("menampilkan status 409 pada pesan modal edit/hapus", () => {
    const error = new PemakaianMaterialApiError(
      "Pemakaian material sudah dipakai produksi dan tidak bisa diubah",
      409,
      "PEMAKAIAN_DIPAKAI_PRODUKSI",
    );

    expect(pesanKesalahanPemakaian(error, "Gagal")).toContain("(409)");
  });

  it("memakai fallback untuk error non-API", () => {
    expect(pesanKesalahanPemakaian("bukan error", "Gagal")).toBe("Gagal");
  });
});
