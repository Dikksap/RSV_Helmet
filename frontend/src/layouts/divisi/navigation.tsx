import {
  faArrowRightArrowLeft,
  faChartColumn,
  faClipboardCheck,
  faClipboardList,
  faHouse,
  faSitemap,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import type { NavGroup, NavItem } from "../RoleLayout";

export const DIVISI_MAIN: NavItem[] = [
  { to: "/divisi/home", label: "Ringkasan", icon: faHouse, end: true },
];

export const DIVISI_GROUPS: NavGroup[] = [
  {
    label: "Divisi",
    icon: faSitemap,
    children: [
      {
        to: "/divisi/produksi",
        label: "Produksi",
        icon: faChartColumn,
        end: true,
      },
      {
        to: "/divisi/transfer-wip",
        label: "Transfer WIP",
        icon: faArrowRightArrowLeft,
        end: true,
      },
      {
        to: "/divisi/permintaan",
        label: "Permintaan Material",
        icon: faClipboardList,
        end: true,
      },
      {
        to: "/divisi/anggota",
        label: "Anggota & Item",
        icon: faUsers,
        end: true,
      },
      {
        to: "/divisi/quality",
        label: "QC Akhir & Repair",
        icon: faClipboardCheck,
        end: true,
      },
    ],
  },
];
