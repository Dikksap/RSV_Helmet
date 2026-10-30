import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getHttpErrorMessage } from "./errors";

describe("API error messages", () => {
  it("menjelaskan saat backend tidak dapat dijangkau", () => {
    expect(getApiErrorMessage(new TypeError("Failed to fetch"), "Gagal")).toContain(
      "Backend tidak dapat dihubungi",
    );
  });

  it("mempertahankan pesan error yang tersedia", () => {
    expect(getApiErrorMessage(new Error("Kredensial salah"), "Gagal")).toBe("Kredensial salah");
  });

  it("memberikan pesan untuk error server tanpa pesan", () => {
    expect(getHttpErrorMessage(503)).toContain("Server mengalami gangguan");
  });
});
