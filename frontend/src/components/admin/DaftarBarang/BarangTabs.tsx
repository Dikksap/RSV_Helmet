import { NavLink, useLocation } from "react-router-dom";

const TAB = "inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition";

export function BarangTabs() {
  const { pathname } = useLocation();
  const base = pathname.startsWith("/gudang") ? "/gudang/barang" : "/admin/barang";

  return (
    <nav aria-label="Tampilan daftar barang" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <NavLink
        to={`${base}/rekap-variant`}
        className={({ isActive }) => `${TAB} ${isActive ? "bg-[#1E3A5F] text-white" : "text-slate-600 hover:bg-slate-100"}`}
      >
        Rekap Varian
      </NavLink>
      <NavLink
        to={base}
        end
        className={({ isActive }) => `${TAB} ${isActive ? "bg-[#1E3A5F] text-white" : "text-slate-600 hover:bg-slate-100"}`}
      >
        Daftar Barang
      </NavLink>
    </nav>
  );
}
