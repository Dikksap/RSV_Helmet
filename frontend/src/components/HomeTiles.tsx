import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { NavItem } from "../layouts/RoleLayout";

export type HomeSection = { title: string; description: string; items: NavItem[] };

export function ModuleSection({ title, description, items }: HomeSection) {
  return (
    <section aria-label={title} className="space-y-4">
      <div className="border-l-4 border-[#00A8E8] pl-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
          <div className="inline-block rounded-full bg-slate-200 p-3 text-slate-400 mb-3">
            <FontAwesomeIcon icon="inbox" className="h-6 w-6" />
          </div>
          <p className="font-semibold text-slate-600">Belum ada modul</p>
          <p className="mt-1 text-sm text-slate-500">Modul {title.toLowerCase()} akan tersedia di sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
      className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center no-underline shadow-sm transition-all duration-200 hover:border-[#00A8E8] hover:shadow-xl hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8] focus-visible:ring-offset-2"
    >
      {/* Icon Container */}
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E3A5F]/[0.08] to-[#00A8E8]/[0.08] text-[#1E3A5F] transition-all duration-200 group-hover:from-[#1E3A5F] group-hover:to-[#00A8E8] group-hover:text-white group-hover:shadow-md">
        <FontAwesomeIcon icon={item.icon} className="h-6 w-6" />
      </div>

      {/* Label */}
      <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-700 transition-colors duration-200 group-hover:text-[#1E3A5F]">
        {item.label}
      </span>

      {/* Subtle underline on hover */}
      <div className="absolute bottom-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-[#1E3A5F] to-[#00A8E8] transition-all duration-200 opacity-0 group-hover:opacity-100" />
    </Link>
  );
}
