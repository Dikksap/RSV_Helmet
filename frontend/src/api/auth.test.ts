import { describe, expect, it } from "vitest";
import { homeForRole } from "./auth";

describe("homeForRole", () => {
  it("mengarahkan role produksi ke halaman produksi", () => {
    expect(homeForRole("produksi")).toBe("/produksi/home");
  });

  it("tetap mengarahkan role lain ke halaman awalnya", () => {
    expect(homeForRole("admin")).toBe("/admin/home");
    expect(homeForRole("gudang")).toBe("/gudang/home");
    expect(homeForRole("qc")).toBe("/");
  });
});
