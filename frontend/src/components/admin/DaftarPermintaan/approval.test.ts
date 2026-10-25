import { describe, expect, it } from "vitest";

import type { PermintaanItemRecord } from "../../../api/permintaanBarang";
import {
  bolehApprove,
  masalahApprove,
  type ApprovalActor,
} from "./approval";

const aktor = (over: Partial<ApprovalActor> = {}): ApprovalActor => ({
  isAdmin: false,
  punyaKelolaItem: true,
  divisiId: 3,
  ...over,
});

const item = (
  over: Partial<PermintaanItemRecord> = {},
): PermintaanItemRecord => ({
  id: 1,
  permintaanId: 1,
  itemId: 10,
  nama: "Batok",
  statusKeputusan: "MENUNGGU",
  jumlahDisetujui: null,
  spesifikasi: null,
  jumlah: 5,
  satuan: "pcs",
  item: {
    id: 10,
    kode: "ITM-10",
    nama: "Batok",
    unit: "pcs",
    divisiId: 3,
  },
  ...over,
});

describe("bolehApprove", () => {
  it("admin selalu boleh, termasuk request tanpa divisi approver", () => {
    expect(
      bolehApprove(
        { divisiApproverId: null },
        aktor({ isAdmin: true, punyaKelolaItem: false, divisiId: null }),
      ),
    ).toBe(true);
  });

  it("non-admin butuh KELOLA_ITEM dan divisi approver yang sama", () => {
    expect(bolehApprove({ divisiApproverId: 3 }, aktor())).toBe(true);
    expect(
      bolehApprove({ divisiApproverId: 3 }, aktor({ punyaKelolaItem: false })),
    ).toBe(false);
    expect(bolehApprove({ divisiApproverId: 4 }, aktor())).toBe(false);
    expect(
      bolehApprove({ divisiApproverId: 3 }, aktor({ divisiId: null })),
    ).toBe(false);
    expect(bolehApprove({ divisiApproverId: null }, aktor())).toBe(false);
  });
});

describe("masalahApprove", () => {
  const record = { divisiPemintaId: 2, divisiApproverId: 3 };

  it("menolak item yang belum dipetakan saat validasi modal", () => {
    expect(
      masalahApprove(
        record,
        [item({ itemId: null, item: null })],
        true,
        true,
      ),
    ).toContain("belum dipetakan");
  });

  it("admin boleh menyetujui item beda divisi", () => {
    expect(
      masalahApprove(
        record,
        [item({ item: { ...item().item!, divisiId: 9 } })],
        true,
        true,
      ),
    ).toBeNull();
  });

  it("non-admin ditolak jika item berasal dari divisi lain", () => {
    expect(
      masalahApprove(
        record,
        [item({ item: { ...item().item!, divisiId: 9 } })],
        false,
        true,
      ),
    ).toContain("tidak berasal dari divisi approver");
  });

  it("item tanpa divisi boleh jika peminta sama dengan approver", () => {
    expect(
      masalahApprove(
        { divisiPemintaId: 3, divisiApproverId: 3 },
        [item({ item: { ...item().item!, divisiId: null } })],
        false,
        true,
      ),
    ).toBeNull();
  });

  it("non-admin tanpa divisi approver selalu ditolak", () => {
    expect(
      masalahApprove(
        { divisiPemintaId: 2, divisiApproverId: null },
        [item()],
        false,
        true,
      ),
    ).toContain("hanya admin");
  });
});
