export type Baris = {
  itemId: string;
  kode: string;
  nama: string;
  divisi: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
};

export const BARIS_KOSONG: Baris = {
  itemId: "",
  kode: "",
  nama: "",
  divisi: "",
  spesifikasi: "",
  jumlah: "",
  satuan: "",
};

export type Notice = { tone: "error" | "success"; text: string };

export type PermintaanDraft = {
  tanggal: string;
  tanggalDibutuhkan: string;
  departemen: string;
  namaPeminta: string;
  kebutuhanUntuk: string;
  prioritas: string;
  alasan: string;
  baris: Baris[];
};
