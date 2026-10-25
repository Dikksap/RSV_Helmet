import type {
  PermintaanBarangRecord,
  PermintaanItemRecord,
} from "../../../api/permintaanBarang";

export interface ApprovalActor {
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
  record: Pick<PermintaanBarangRecord, "divisiApproverId">,
  actor: ApprovalActor,
): boolean {
  if (actor.isAdmin) return true;

  return (
    actor.punyaKelolaItem &&
    actor.divisiId !== null &&
    record.divisiApproverId === actor.divisiId
  );
}

/**
 * Alasan approval belum boleh dikirim. `cekMaster` dipakai modal karena item
 * teks bebas harus dipetakan dulu; tombol baris tetap membuka modal agar
 * pemetaan bisa dilakukan.
 */
export function masalahApprove(
  record: DivisiPermintaan,
  items: readonly ItemMapping[],
  isAdmin: boolean,
  cekMaster: boolean,
): string | null {
  if (cekMaster) {
    const belumDipetakan = items.find((item) => item.itemId == null || !item.item);
    if (belumDipetakan) {
      return `Item "${belumDipetakan.nama}" belum dipetakan ke master.`;
    }
  }

  if (isAdmin) return null;

  const approverId = record.divisiApproverId;
  if (approverId === null) {
    return "Permintaan ini belum memiliki divisi approver; hanya admin yang dapat menyetujui.";
  }

  for (const item of items) {
    if (item.itemId == null || !item.item) continue;

    const divisiItem = item.item.divisiId;
    const fallback =
      divisiItem === null && record.divisiPemintaId === approverId;
    if (!fallback && divisiItem !== approverId) {
      return `Item "${item.nama}" tidak berasal dari divisi approver.`;
    }
  }

  return null;
}
