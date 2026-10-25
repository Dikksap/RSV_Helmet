import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArchive,
  faBook,
  faBoxesStacked,
  faChartColumn,
  faClipboardCheck,
  faClipboardList,
  faDatabase,
  faFileLines,
  faGear,
  faHouse,
  faKey,
  faLayerGroup,
  faPlug,
  faSitemap,
  faTags,
  faTruck,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Interface untuk item menu navigasi tunggal
 */
export interface NavItem {
  to: string;
  label: string;
  icon: IconDefinition;
  end?: boolean;
  description?: string;
}

/**
 * Interface untuk grup/kategori navigasi dengan sub-menu (children)
 */
export interface NavGroup {
  label: string;
  icon: IconDefinition;
  children: NavItem[];
  description?: string;
}

export const NAV_MAIN: NavItem[] = [
  {
    to: "/admin/home",
    label: "Homepage",
    icon: faHouse,
    end: true,
  },
];

export const BARANG_PRODUKSI: NavGroup = {
  label: "Barang Produksi",
  icon: faBoxesStacked,
  description: "Kelola aktivitas dan proses produksi",
  children: [
    {
      to: "/admin/barang",
      label: "Daftar Produksi Helm",
      icon: faBoxesStacked,
      end: true,
      description: "Data master produksi helm",
    },
    {
      to: "/admin/stok-produksi",
      label: "Stok Produksi Koli",
      icon: faArchive,
      end: true,
      description: "Stok koli hasil produksi",
    },
    {
      to: "/admin/hasil-produksi-divisi",
      label: "Hasil Produksi Harian",
      icon: faChartColumn,
      end: true,
      description: "Laporan capaian produksi harian",
    },
    {
      to: "/divisi/home",
      label: "Ruang Divisi",
      icon: faSitemap,
      end: false,
      description: "Area kerja antar divisi",
    },
    {
      to: "/admin/pengaturan",
      label: "Pengaturan",
      icon: faGear,
      end: false,
      description: "Konfigurasi sistem produksi",
    },
  ],
};

export const MANAJEMEN: NavGroup = {
  label: "Manajemen",
  icon: faClipboardList,
  description: "Kelola data dan kebutuhan operasional",
  children: [
    {
      to: "/admin/plan-production",
      label: "Jadwal Produksi",
      icon: faClipboardList,
      end: false,
      description: "Perencanaan waktu produksi",
    },
    {
      to: "/admin/spk",
      label: "SPK Produksi",
      icon: faFileLines,
      end: true,
      description: "Surat Perintah Kerja",
    },
    {
      to: "/admin/batch",
      label: "Kelola Batch",
      icon: faLayerGroup,
      end: true,
      description: "Pengelompokan batch produksi",
    },
    {
      to: "/admin/bom",
      label: "BOM & Subassembly",
      icon: faLayerGroup,
      end: true,
      description: "Bill of Materials produk",
    },
    {
      to: "/admin/realisasi-produksi",
      label: "Realisasi Produksi",
      icon: faClipboardCheck,
      end: false,
      description: "Pencatatan aktual produksi",
    },
  ],
};

export const WAREHOUSE: NavGroup = {
  label: "Warehouse",
  icon: faBoxesStacked,
  description: "Kelola aktivitas dan persediaan warehouse",
  children: [
    {
      to: "/admin/permintaan-barang",
      label: "Permintaan Barang",
      icon: faClipboardList,
      end: true,
      description: "Pengajuan barang & material",
    },
    {
      to: "/admin/pemakaian-material",
      label: "Pemakaian Material",
      icon: faBoxesStacked,
      end: true,
      description: "Catatan konsumsi bahan baku",
    },
    {
      to: "/admin/item",
      label: "Stock Material & item",
      icon: faTags,
      end: true,
      description: "Master stok barang & bahan",
    },
    {
      to: "/admin/stok-opname",
      label: "Opname Stok",
      icon: faClipboardCheck,
      end: true,
      description: "Verifikasi fisik persediaan",
    },
    {
      to: "/admin/gudang",
      label: "Gudang Hasil Produksi",
      icon: faArchive,
      end: true,
      description: "Penyimpanan produk jadi",
    },
    {
      to: "/admin/mutasi-gudang",
      label: "Riwayat Mutasi Helm",
      icon: faFileLines,
      end: true,
      description: "Perpindahan stok barang",
    },
  ],
};

export const ERP_OPERATIONS: NavGroup = {
  label: "ERP Operasional",
  icon: faClipboardCheck,
  description: "Ledger, quality, dan distribusi",
  children: [
    {
      to: "/admin/inventory",
      label: "Ledger Lokasi",
      icon: faBoxesStacked,
      end: true,
      description: "Saldo dan gerakan inventory per lokasi",
    },
    {
      to: "/admin/quality",
      label: "QC Akhir",
      icon: faClipboardCheck,
      end: true,
      description: "Reject item Top Coat, antrean repair, dan pemeriksaan hasil",
    },
    {
      to: "/admin/wip-flow",
      label: "Aliran WIP & Opname",
      icon: faChartColumn,
      end: true,
      description: "Laporan produksi, QC, repair, dan rekonsiliasi fisik WIP",
    },
    {
      to: "/admin/shipments",
      label: "Shipment",
      icon: faTruck,
      end: true,
      description: "Pengiriman pelanggan dan retur",
    },
  ],
};

export const KARYAWAN: NavGroup = {
  label: "Karyawan",
  icon: faUsers,
  description: "Kelola data master karyawan",
  children: [
    {
      to: "/admin/karyawan",
      label: "Kelola Karyawan",
      icon: faUsers,
      end: true,
      description: "Data personalia karyawan",
    },
    {
      to: "/admin/divisi",
      label: "Kelola Divisi",
      icon: faSitemap,
      end: true,
      description: "Struktur organisasi divisi",
    },
    {
      to: "/admin/user",
      label: "Kelola User",
      icon: faUsers,
      end: true,
      description: "Akun pengguna sistem",
    },
    {
      to: "/admin/role",
      label: "Kelola Permission",
      icon: faKey,
      end: true,
      description: "Hak akses & peran pengguna",
    },
  ],
};

export const NAV_MANAGEMENT: NavItem[] = [
  {
    to: "/",
    label: "Halaman Utama",
    icon: faHouse,
    end: false,
    description: "Kembali ke landing page publik",
  },
];

export const PENGATURAN: NavGroup = {
  label: "Pengaturan",
  icon: faGear,
  description: "Pengaturan & konfigurasi sistem",
  children: [
    {
      to: "/admin/pengaturan/variant-produk",
      label: "Variant Produk",
      icon: faTags,
      end: false,
      description: "Kategori & variasi produk",
    },
    {
      to: "/admin/pengaturan/master-data",
      label: "Master Data",
      icon: faDatabase,
      end: false,
      description: "Kelola data acuan sistem",
    },
  ],
};

export const NAV_INTEGRASI: NavGroup = {
  label: "Integrasi",
  icon: faPlug,
  description: "Hubungkan sistem dengan layanan luar",
  children: [
    {
      to: "/admin/integrasi-jurnal",
      label: "Data Mekari Jurnal",
      icon: faBook,
      end: false,
      description: "Sinkronisasi akuntansi Jurnal",
    },
  ],
};