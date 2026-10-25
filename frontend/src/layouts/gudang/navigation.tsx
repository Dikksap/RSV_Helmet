import { faArchive, faBoxesStacked, faChartColumn, faClipboardCheck, faClipboardList, faHouse, faTags } from "@fortawesome/free-solid-svg-icons";

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
  children: [
    { to: "/gudang/permintaan-barang", label: "Permintaan Barang", icon: faClipboardList, end: true },
    { to: "/gudang/pemakaian-material", label: "Pemakaian Material", icon: faBoxesStacked, end: true },
  ],
};

export const GUDANG_WAREHOUSE: NavGroup = {
  label: "Warehouse",
  icon: faArchive,
  children: [
    { to: "/gudang/item", label: "Stock Material", icon: faTags, end: true },
    { to: "/gudang/stok-opname", label: "Opname Stok", icon: faClipboardCheck, end: true },
  ],
};

export const GUDANG_ERP: NavGroup = {
  label: "ERP",
  icon: faBoxesStacked,
  children: [
    { to: "/gudang/inventory", label: "Ledger Lokasi", icon: faBoxesStacked, end: true },
    { to: "/gudang/wip-flow", label: "Aliran WIP & Opname", icon: faChartColumn, end: true },
    { to: "/gudang/shipments", label: "Shipment & Retur", icon: faClipboardList, end: true },
  ],
};

export const GUDANG_GROUPS: NavGroup[] = [GUDANG_BARANG, GUDANG_WAREHOUSE, GUDANG_PERMINTAAN, GUDANG_ERP].filter(
  (g) => g.children.length > 0,
);
