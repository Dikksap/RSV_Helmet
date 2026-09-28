import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PENGATURAN } from "../../layouts/admin/navigation";
import VariantProduk from "./VariantProduk";
import MasterData from "./MasterData";

function PengaturanBarangProduksi() {
  return (
    <div className="w-full space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight text-[#1E3A5F]">
          {PENGATURAN.label}
        </h2>
        <p className="mt-0.5 text-xs text-[#6B7280]">
          Kelola variant produk dan master data
        </p>
      </header>

      <nav
        aria-label="Tab pengaturan"
        className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
      >
        {PENGATURAN.children.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#1E3A5F] text-white shadow-sm"
                  : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]",
              ].join(" ")
            }
          >
            <FontAwesomeIcon icon={item.icon} className="h-4 w-4" fixedWidth />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Navigate to="variant-produk" replace />} />
        <Route path="variant-produk" element={<VariantProduk />} />
        <Route path="master-data" element={<MasterData />} />
        <Route path="*" element={<Navigate to="variant-produk" replace />} />
      </Routes>
    </div>
  );
}

export default PengaturanBarangProduksi;
