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

  it("role gudang atau admin boleh approve", () => {
    expect(
      bolehApprove(
        { divisiApproverId: 3 },
        aktor({ role: "gudang", isAdmin: false }),
      ),
    ).toBe(true);
    expect(
      bolehApprove(
        { divisiApproverId: 3 },
        aktor({ role: "operator", isAdmin: false }),
      ),
    ).toBe(false);
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

  it("admin atau gudang boleh menyetujui jika item sudah dipetakan", () => {
    expect(
      masalahApprove(
        record,
        [item({ item: { ...item().item!, divisiId: 9 } })],
        true,
        true,
      ),
    ).toBeNull();
  });

  it("menolak jika user bukan admin atau gudang", () => {
    expect(
      masalahApprove(
        record,
        [item({ item: { ...item().item!, divisiId: 9 } })],
        false,
        true,
      ),
    ).toContain("Hanya role gudang atau admin");
  });
});
