import type {
  PemakaianMaterialRecord,
} from "../../../api/pemakaianMaterial";

export type ActiveTab = "riwayat" | "stok";

export interface PemakaianFilterState {
  search: string;
  divisiId: string;
  dateFrom: string;
  dateTo: string;
}

export interface PemakaianPaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SummaryStatItem {
  label: string;
  value: number | string;
  hint: string;
  accent: string;
  iconType: "record" | "divisi" | "material" | "sisa";
}

export interface ModalFormItemState {
  permintaanBarangItemId: number;
  itemId: number | null;
  nama: string;
  satuan: string;
  stokSebelum: number;
  sisaFisik: string;
  used: boolean;
  keteranganSisa: string;
}

export interface ModalFormState {
  open: boolean;
  mode: "create" | "edit";
  editId: number | null;
  divisiId: string;
  permintaanId: string;
  tanggal: string;
  keterangan: string;
  busy: boolean;
  error: string | null;
  items: Record<number, ModalFormItemState>; // keyed by permintaanBarangItemId
}

export interface ModalDetailState {
  open: boolean;
  record: PemakaianMaterialRecord | null;
}

export interface ModalDeleteState {
  open: boolean;
  record: PemakaianMaterialRecord | null;
  busy: boolean;
  error: string | null;
}
