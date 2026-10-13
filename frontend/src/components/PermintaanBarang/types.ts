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
