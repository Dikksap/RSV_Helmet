import { faArchive, faBoxesStacked, faClipboardCheck, faClipboardList, faHouse, faTags } from "@fortawesome/free-solid-svg-icons";

import type { NavGroup, NavItem } from "../RoleLayout";

export const GUDANG_MAIN: NavItem[] = [
  { to: "/gudang/home", label: "Beranda", icon: faHouse, end: true },
];

export const GUDANG_BARANG: NavGroup = {
  label: "Barang",
  icon: faBoxesStacked,
  children: [
    { to: "/gudang/barang", label: "Daftar Barang", icon: faBoxesStacked, end: true },
    { to: "/gudang/stok-produksi", label: "Stok Produksi", icon: faArchive, end: true },
    { to: "/gudang/mutasi", label: "Riwayat Mutasi", icon: faClipboardList, end: true },
  ],
};

export const GUDANG_PERMINTAAN: NavGroup = {
  label: "Permintaan",
  icon: faClipboardList,
  children: [{ to: "/gudang/permintaan-barang", label: "Permintaan Barang", icon: faClipboardList, end: true }],
};

export const GUDANG_WAREHOUSE: NavGroup = {
  label: "Warehouse",
  icon: faArchive,
  children: [
    { to: "/gudang/item", label: "Kelola Item", icon: faTags, end: true },
    { to: "/gudang/stok-opname", label: "Opname Stok", icon: faClipboardCheck, end: true },
  ],
};

export const GUDANG_GROUPS: NavGroup[] = [GUDANG_BARANG, GUDANG_WAREHOUSE, GUDANG_PERMINTAAN].filter(
  (g) => g.children.length > 0,
);
