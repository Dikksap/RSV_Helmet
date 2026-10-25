import type { StokDivisiRecord } from "../../../api/pemakaianMaterial";

export function saldoWip(
  stokDivisi: readonly StokDivisiRecord[],
  divisiId: number,
  itemId: number | null,
): number | null {
  // null = belum ada baris WIP; pemanggil memakai fallback request lama.
  if (itemId === null) return null;
  const material = stokDivisi
    .find((group) => group.divisiId === divisiId)
    ?.materials.find((row) => row.itemId === itemId);
  return material ? material.sisa : null;
}
