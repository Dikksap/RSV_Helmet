import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInbox } from "@fortawesome/free-solid-svg-icons";
import type { NavItem } from "../layouts/RoleLayout";

export type HomeSection = { title: string; description: string; items: NavItem[] };

export function ModuleSection({ title, description, items }: HomeSection) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="border-l-[3px] border-accent-500 pl-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-navy-900">{title}</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
            <FontAwesomeIcon icon={faInbox} className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-semibold text-navy-900">Belum ada modul</p>
          <p className="mt-1 text-xs text-slate-500">
            Modul {title.toLowerCase()} akan tersedia di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
      className="group flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 no-underline shadow-[0_1px_2px_rgba(15,28,46,0.03)] transition hover:-translate-y-0.5 hover:border-accent-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-600/[0.06] text-navy-600 transition group-hover:bg-navy-600 group-hover:text-white">
        <FontAwesomeIcon icon={item.icon} className="h-3.5 w-3.5" />
      </span>
      <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-700 transition-colors group-hover:text-navy-900">
        {item.label}
      </span>
    </Link>
  );
}
