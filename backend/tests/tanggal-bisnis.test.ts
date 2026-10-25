import { describe, expect, it } from "vitest";
import {
  awalHariBisnis,
  parseTanggalBisnis,
  tambahHariBisnis,
  tanggalBisnis,
} from "../src/lib/tanggalBisnis.js";

describe("tanggal bisnis Asia/Jakarta", () => {
  it("membaca instant UTC sebagai tanggal Jakarta", () => {
    expect(tanggalBisnis(new Date("2026-10-21T17:00:00.000Z"))).toBe("2026-10-22");
  });

  it("mengubah date-only menjadi awal hari Jakarta", () => {
    expect(awalHariBisnis("2026-10-22").toISOString()).toBe("2026-10-21T17:00:00.000Z");
    expect(tambahHariBisnis("2026-10-22", 1).toISOString()).toBe("2026-10-22T17:00:00.000Z");
  });

  it("menolak tanggal kalender yang tidak ada", () => {
    expect(parseTanggalBisnis("2026-02-30")).toBeNull();
    expect(parseTanggalBisnis("2026-10-22")?.toISOString()).toBe("2026-10-21T17:00:00.000Z");
  });
});
