// Klasifikasi dus: "biasa" (finishgood murni) vs "pengganti" (barang berstatus riwayat retur).
// Dus pengganti diberi nama "DUS PENGGANTI <n>", dus biasa "DUS <n>".
// Penomoran hanya menghitung dus aktif (!isArsip) agar reset ke 1 saat lama diarsipkan.

type DusLike = {
  nama: string;
  isArsip?: boolean;
  barang?: { pernahRetur?: boolean }[];
};

export function familyOfDus(nama: string): "biasa" | "pengganti" {
  return /^dus\s*pengganti/i.test(nama.trim()) ? "pengganti" : "biasa";
}

export function isDusPengganti(g: DusLike): boolean {
  if (familyOfDus(g.nama) === "pengganti") return true;
  return (g.barang ?? []).some((b) => b.pernahRetur);
}

export const DUS_CAPACITY = 8;

export function nextDusName(groups: DusLike[], pengganti: boolean): string {
  const prefix = pengganti ? "DUS PENGGANTI" : "DUS";
  let max = 0;
  for (const g of groups) {
    if (g.isArsip) continue;
    if ((familyOfDus(g.nama) === "pengganti") !== pengganti) continue;
    const m = g.nama.trim().match(/^dus(?:\s*pengganti)?\s*(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix} ${max + 1}`;
}
