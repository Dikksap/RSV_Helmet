/* eslint-disable react-refresh/only-export-components -- constants file, not a component */
import {
  faArchive,
  faBook,
  faBoxesStacked,
  faClipboardCheck,
  faClipboardList,
  faDatabase,
  faFileLines,
  faGear,
  faHouse,
  faPlug,
  faTags,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export const NAV_MAIN = [
  {
    to: "/admin/home",
    label: "Homepage",
    icon: faHouse,
    end: true,
  },
];

export const BARANG_PRODUKSI = {
  label: "Barang Produksi",
  icon: faBoxesStacked,
  children: [
    {
      to: "/admin/barang",
      label: "Daftar Barang",
      icon: faBoxesStacked,
      end: true,
    },
    {
      to: "/admin/stok-produksi",
      label: "Stok Produksi",
      icon: faArchive,
      end: true,
    },
    {
      to: "/admin/pengaturan",
      label: "Pengaturan",
      icon: faGear,
      end: false,
    },
  ],
};

export const MANAJEMEN = {
  label: "Manajemen",
  icon: faClipboardList,
  children: [
    {
      to: "/admin/plan-production",
      label: "Plan Production",
      icon: faClipboardList,
      end: false,
    },
    {
      to: "/admin/spk",
      label: "SPK Produksi",
      icon: faFileLines,
      end: true,
    },
    {
      to: "/admin/realisasi-produksi",
      label: "Realisasi Produksi",
      icon: faClipboardCheck,
      end: false,
    },
  ],
};

export const WAREHOUSE: typeof MANAJEMEN = {
  label: "Warehouse",
  icon: faBoxesStacked,
  children: [],
};

export const KARYAWAN: typeof MANAJEMEN = {
  label: "Karyawan",
  icon: faUsers,
  children: [
    {
      to: "/admin/karyawan",
      label: "Kelola Karyawan",
      icon: faUsers,
      end: true,
    },
  ],
};

export const NAV_MANAGEMENT = [
  { to: "/", label: "Halaman Utama", icon: faHouse, end: false },
];

export const PENGATURAN = {
  label: "Pengaturan",
  icon: faGear,
  children: [
    {
      to: "/admin/pengaturan/variant-produk",
      label: "Variant Produk",
      icon: faTags,
      end: false,
    },
    {
      to: "/admin/pengaturan/master-data",
      label: "Master Data",
      icon: faDatabase,
      end: false,
    },
  ],
};

export const NAV_INTEGRASI = {
  label: "Integrasi",
  icon: faPlug,
  children: [
    {
      to: "/admin/integrasi-jurnal",
      label: "Data Mekari Jurnal",
      icon: faBook,
      end: false,
    },
  ],
};
