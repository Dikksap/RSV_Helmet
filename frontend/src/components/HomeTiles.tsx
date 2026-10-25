import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { NavItem } from "../layouts/RoleLayout";

export type HomeSection = { title: string; description: string; items: NavItem[] };

export function ModuleSection({ title, description, items }: HomeSection) {
  return (
    <section aria-label={title} className="space-y-2.5 sm:space-y-4">
      {/* Header Section dengan Indikator Kiri Ringkas */}
      <div className="border-l-3 border-[#00A8E8] pl-2.5 sm:border-l-4 sm:pl-4">
        <h2 className="text-base font-bold text-slate-900 sm:text-xl">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">{description}</p>
      </div>

      {/* Empty State Ringkas */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center sm:rounded-2xl sm:px-8 sm:py-10">
          <div className="mb-2 inline-block rounded-full bg-slate-200/80 p-2 text-slate-400 sm:mb-3 sm:p-3">
            <FontAwesomeIcon icon="inbox" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-600 sm:text-sm">Belum ada modul</p>
          <p className="mt-0.5 text-[0.7rem] text-slate-500 sm:text-xs">
            Modul {title.toLowerCase()} akan tersedia di sini.
          </p>
        </div>
      ) : (
        /* Grid Tile Hemat Ruang di Mobile */
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <MenuTile key={item.to} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MenuTile({ item }: { item: NavItem }) {
  return (
    <Link
      to={item.to}
      title={item.label}
      className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-center no-underline shadow-2xs transition-all duration-200 hover:border-[#00A8E8] hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8] focus-visible:ring-offset-2 sm:gap-3 sm:rounded-2xl sm:p-4 sm:shadow-sm sm:hover:-translate-y-1"
    >
      {/* Icon Container Ringkas (40px di Mobile, 56px di Desktop) */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E3A5F]/[0.08] to-[#00A8E8]/[0.08] text-[#1E3A5F] transition-all duration-200 group-hover:from-[#1E3A5F] group-hover:to-[#00A8E8] group-hover:text-white group-hover:shadow-md sm:h-14 sm:w-14 sm:rounded-xl">
        <FontAwesomeIcon icon={item.icon} className="h-4 w-4 sm:h-6 sm:w-6" />
      </div>

      {/* Label Modul */}
      <span className="line-clamp-2 text-xs font-semibold leading-snug text-slate-700 transition-colors duration-200 group-hover:text-[#1E3A5F] sm:text-sm">
        {item.label}
      </span>

      {/* Underline Akses Visual Saat Hover */}
      <div className="absolute bottom-0 h-0.5 w-6 rounded-full bg-gradient-to-r from-[#1E3A5F] to-[#00A8E8] opacity-0 transition-all duration-200 group-hover:opacity-100 sm:w-8" />
    </Link>
  );
}