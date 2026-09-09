import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faChartPie,
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
          "flex min-w-[52px] flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 transition-all duration-200",
          isActive
            ? "scale-105 bg-brand-gold/10 text-brand-gold"
            : "text-brand-grey hover:bg-brand-surface hover:text-white",
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
