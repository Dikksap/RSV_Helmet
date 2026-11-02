import type {
  PermintaanBarangRecord,
  PermintaanItemRecord,
} from "../../../api/permintaanBarang";

export interface ApprovalActor {
  role?: string;
  isAdmin: boolean;
  punyaKelolaItem: boolean;
  divisiId: number | null;
}

type ItemMapping = Pick<PermintaanItemRecord, "nama" | "itemId" | "item">;
type DivisiPermintaan = Pick<
  PermintaanBarangRecord,
  "divisiPemintaId" | "divisiApproverId"
>;

export function bolehApprove(
  _record: Pick<PermintaanBarangRecord, "divisiApproverId">,
  actor: ApprovalActor,
): boolean {
  return actor.isAdmin || actor.role === "gudang";
}

/**
 * Alasan approval belum boleh dikirim. `cekMaster` dipakai modal karena item
 * teks bebas harus dipetakan dulu; tombol baris tetap membuka modal agar
 * pemetaan bisa dilakukan.
 */
export function masalahApprove(
  _record: DivisiPermintaan,
  items: readonly ItemMapping[],
  boleh: boolean,
  cekMaster: boolean,
): string | null {
  if (cekMaster) {
    const belumDipetakan = items.find((item) => item.itemId == null || !item.item);
    if (belumDipetakan) {
      return `Item "${belumDipetakan.nama}" belum dipetakan ke master.`;
    }
  }

  return boleh ? null : "Hanya role gudang atau admin yang dapat menyetujui permintaan.";
}
