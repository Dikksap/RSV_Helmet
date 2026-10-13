import { describe, it, expect } from "vitest";
import { statusScopeFilter } from "../src/model/barang/barang.status.js";
import { barangScope, isStatusInView } from "../src/controller/barang/helpers.js";

describe("statusScopeFilter", () => {
  it("scope null (admin) tanpa status = tanpa filter", () => {
    expect(statusScopeFilter(null)).toBeUndefined();
  });

  it("scope null + status = status apa adanya", () => {
    expect(statusScopeFilter(null, "OUT")).toBe("OUT");
  });

  it("scope terdefinisi tanpa status = in(scope)", () => {
    expect(statusScopeFilter(["FINISHGOOD", "RETUR"])).toEqual({ in: ["FINISHGOOD", "RETUR"] });
  });

  it("status dalam scope = status", () => {
    expect(statusScopeFilter(["FINISHGOOD", "RETUR"], "RETUR")).toBe("RETUR");
  });

  it("status di luar scope = in([]) (deny, bukan bocor)", () => {
    expect(statusScopeFilter(["FINISHGOOD"], "OUT")).toEqual({ in: [] });
  });

  it("scope kosong = in([]) walau tanpa status", () => {
    expect(statusScopeFilter([])).toEqual({ in: [] });
  });
});

describe("barangScope / isStatusInView", () => {
  const req = (statusView: string[] | null | undefined) =>
    ({ access: statusView === undefined ? undefined : { role: "x", permissions: [], statusView } }) as any;

  it("tanpa req.access gagal tertutup (deny semua)", () => {
    expect(barangScope(req(undefined))).toEqual([]);
    expect(isStatusInView(barangScope(req(undefined)), "FINISHGOOD")).toBe(false);
  });

  it("admin (null) lihat semua", () => {
    expect(isStatusInView(barangScope(req(null)), "REGISTER")).toBe(true);
  });

  it("role terbatas hanya lihat scope, case-insensitive", () => {
    const scope = barangScope(req(["FINISHGOOD"]));
    expect(isStatusInView(scope, "finishgood")).toBe(true);
    expect(isStatusInView(scope, " BAD ")).toBe(false);
  });
});
