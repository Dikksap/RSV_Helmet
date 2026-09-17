import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faChartPie,
  faClipboardList,
  faDatabase,
  faGaugeHigh,
  faHouse,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { NavLink } from "react-router-dom";

export const NAV_MAIN = [
  {
    to: "/admin/dashboard",
    label: "Dasbor Utama",
    icon: faGaugeHigh,
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
      to: "/admin/barang/statistik",
      label: "Statistik Barang",
      icon: faChartPie,
      end: false,
    },
    {
      to: "/admin/variant-produk",
      label: "Variant Produk",
      icon: faTags,
      end: false,
    },
    {
      to: "/admin/master-data",
      label: "Master Data",
      icon: faDatabase,
      end: false,
    },
    {
      to: "/admin/plan-production",
      label: "Plan Production",
      icon: faClipboardList,
      end: false,
    },
  ],
};

export const NAV_MANAGEMENT = [
  { to: "/", label: "Halaman Utama", icon: faHouse, end: false },
];

export const ADMIN_MOBILE_NAV = [
  { to: "/", label: "Home", icon: faHouse, end: true, center: false },
  {
    to: "/admin/barang",
    label: "Barang",
    icon: faBoxesStacked,
    end: true,
    center: false,
  },
  {
    to: "/admin/dashboard",
    label: "Dasbor",
    icon: faGaugeHigh,
    end: true,
    center: true,
  },
  {
    to: "/admin/barang/statistik",
    label: "Statistik",
    icon: faChartPie,
    end: false,
    center: false,
  },
  {
    to: "/admin/variant-produk",
    label: "Varian",
    icon: faTags,
    end: false,
    center: false,
  },
] as const;

type AdminMobileNavItem = (typeof ADMIN_MOBILE_NAV)[number];

export function AdminMobileNavLink({ item }: { item: AdminMobileNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "flex min-w-[52px] flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8]",
          isActive
            ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
            : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
        ].join(" ")
      }
    >
      <FontAwesomeIcon icon={item.icon} className="h-5 w-5" fixedWidth />
      <span className="text-[10px] font-bold uppercase tracking-tight">
        {item.label}
      </span>
    </NavLink>
  );
}
