import { describe, expect, it } from "vitest";
import { buildScanReportText, groupReportItems, mergeReportItems, type ScanReportItem } from "./scanReport";

const item = (partial: Partial<ScanReportItem>): ScanReportItem => ({
  kode: "A1",
  variant: "RSV X Merah L",
  status: "FINISHGOOD",
  waktu: "08:00:00",
  ...partial,
});

describe("scanReport", () => {
  it("menggabungkan item tanpa duplikat kode+status", () => {
    const existing = [item({ kode: "A1" })];
    const next = mergeReportItems(existing, [
      item({ kode: "a1 " }),
      item({ kode: "A1", status: "RETUR" }),
      item({ kode: "B2" }),
    ]);
    expect(next).toHaveLength(3);
    expect(next.map((it) => `${it.kode}|${it.status}`)).toEqual(["A1|FINISHGOOD", "A1|RETUR", "B2|FINISHGOOD"]);
  });

  it("membuat teks laporan dengan total, per status, dan detail", () => {
    const text = buildScanReportText(
      [item({ kode: "A1" }), item({ kode: "B2", status: "RETUR", dus: "DUS 1" })],
      "26 Oktober 2026",
      (kode) => (kode === "RETUR" ? "Retur" : "Finish Good"),
    );
    expect(text).toContain("Total: 2 item");
    expect(text).toContain("- RSV X Merah L · Finish Good: 1");
    expect(text).toContain("- RSV X Merah L · Retur: 1");
    expect(text).toContain("2. B2 — Retur — RSV X Merah L — 08:00:00 — DUS 1");
  });

  it("meringkas jumlah per varian dan status", () => {
    const groups = groupReportItems([
      item({ kode: "A1" }),
      item({ kode: "A2" }),
      item({ kode: "B1", variant: "RSV Y Biru M", status: "RETUR" }),
      item({ kode: "A3", status: "RETUR" }),
    ]);
    expect(groups).toEqual([
      { variant: "RSV X Merah L", status: "FINISHGOOD", jumlah: 2 },
      { variant: "RSV X Merah L", status: "RETUR", jumlah: 1 },
      { variant: "RSV Y Biru M", status: "RETUR", jumlah: 1 },
    ]);
  });
});
