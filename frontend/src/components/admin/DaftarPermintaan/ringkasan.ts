import type {
  PermintaanBarangRecord,
  PermintaanItemRecord,
} from "../../../api/permintaanBarang";

export const TANPA_DIVISI = "Tanpa divisi";

export interface KelompokDivisi {
  nama: string;
  permintaan: PermintaanBarangRecord[];
}

export interface RingkasanItem {
  kunci: string;
  nama: string;
  spesifikasi: string;
  satuan: string;
  disetujui: number;
  belum: number;
  total: number;
}

const namaDivisi = (record: PermintaanBarangRecord) =>
  record.divisiPeminta?.nama?.trim() || TANPA_DIVISI;

export function kelompokkanPerDivisi(
  rows: PermintaanBarangRecord[],
): KelompokDivisi[] {
  const kelompok = new Map<string, KelompokDivisi>();

  for (const record of rows) {
    const nama = namaDivisi(record);
    const ada = kelompok.get(nama);
    if (ada) {
      ada.permintaan.push(record);
    } else {
      kelompok.set(nama, { nama, permintaan: [record] });
    }
  }

  return [...kelompok.values()].sort((a, b) => {
    if (a.nama === TANPA_DIVISI) return 1;
    if (b.nama === TANPA_DIVISI) return -1;
    return a.nama.localeCompare(b.nama, "id");
  });
}

const kunciItem = (item: PermintaanItemRecord) =>
  [item.nama, item.spesifikasi ?? "", item.satuan ?? ""].join("||");

/**
 * Ringkasan item lintas permintaan. Permintaan disetujui memakai jumlah yang
 * disetujui (fallback jumlah diminta); permintaan belum disetujui memakai
 * jumlah diminta. Item yang ditolak tidak dihitung.
 */
export function ringkasItem(
  rows: PermintaanBarangRecord[],
): RingkasanItem[] {
  const ringkasan = new Map<string, RingkasanItem>();

  for (const record of rows) {
    for (const item of record.items) {
      if (record.approval === "DISETUJUI" && item.statusKeputusan === "DITOLAK") {
        continue;
      }

      const kunci = kunciItem(item);
      const ada = ringkasan.get(kunci) ?? {
        kunci,
        nama: item.nama,
        spesifikasi: item.spesifikasi ?? "",
        satuan: item.satuan ?? "",
        disetujui: 0,
        belum: 0,
        total: 0,
      };

      if (record.approval === "DISETUJUI") {
        ada.disetujui += item.jumlahDisetujui ?? item.jumlah;
      } else {
        ada.belum += item.jumlah;
      }
      ada.total = ada.disetujui + ada.belum;

      ringkasan.set(kunci, ada);
    }
  }

  return [...ringkasan.values()].sort(
    (a, b) =>
      a.nama.localeCompare(b.nama, "id") ||
      a.spesifikasi.localeCompare(b.spesifikasi, "id") ||
      a.satuan.localeCompare(b.satuan, "id"),
  );
}
