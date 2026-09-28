import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  BARANG_PRODUKSI,
  NAV_INTEGRASI,
  NAV_MANAGEMENT,
} from "../../layouts/admin/navigation";

function Homepage() {
  return (
    <div className="w-full space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight text-[#1E3A5F]">
          Selamat Datang
        </h2>
        <p className="mt-0.5 text-xs text-[#6B7280]">
          Pilih modul untuk mulai mengelola
        </p>
      </header>

      <section aria-label={BARANG_PRODUKSI.label}>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
          {BARANG_PRODUKSI.label}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BARANG_PRODUKSI.children.map((item) => (
            <MenuCard key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </div>
      </section>

      <section aria-label={NAV_INTEGRASI.label}>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
          {NAV_INTEGRASI.label}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_INTEGRASI.children.map((item) => (
            <MenuCard key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </div>
      </section>

      <section aria-label="Manajemen">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
          Manajemen
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_MANAGEMENT.map((item) => (
            <MenuCard key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MenuCard({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesomeIcon>["icon"];
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:-translate-y-[1px] hover:border-sky-300 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F]/5 text-[#1E3A5F]">
        <FontAwesomeIcon icon={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1F2937]">
        {label}
      </span>
      <span aria-hidden="true" className="shrink-0 text-slate-300">
        →
      </span>
    </Link>
  );
}

export default Homepage;
