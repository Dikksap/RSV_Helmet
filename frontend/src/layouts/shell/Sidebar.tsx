import { Link, NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faArrowUpRightFromSquare,
  faChevronDown,
  faMagnifyingGlass,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import type { NavGroup, NavItem } from "../RoleLayout";
import { findActiveGroup, initialsFromName, matchesNav } from "./nav-utils";
import logoUrl from "../../assets/logo.png";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60";

export interface SidebarProps {
  brand: string;
  subtitle: string;
  main: NavItem[];
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
  onOpenPalette: () => void;
  onNavigate: () => void;
  onClose?: () => void;
  userName: string;
  userRoleLabel: string;
  avatarSrc: string | null;
  profileTo: string;
  onLogout: () => void;
  homeTo: string;
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          "group relative flex h-9 items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
          FOCUS,
          collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          isActive
            ? "bg-white/[0.09] text-white"
            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent-500 transition-opacity ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          />
          <FontAwesomeIcon
            icon={item.icon}
            fixedWidth
            className={`h-4 w-4 shrink-0 ${
              isActive ? "text-accent-400" : "text-slate-500 group-hover:text-slate-300"
            }`}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

function GroupSection({
  group,
  collapsed,
  pathname,
  open,
  onToggleGroup,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  open: boolean;
  onToggleGroup: (label: string) => void;
  onNavigate: () => void;
}) {
  const active = group.children.some((item) => matchesNav(pathname, item));
  const panelId = `nav-panel-${group.label.replace(/\s+/g, "-").toLowerCase()}`;

  if (collapsed) {
    return (
      <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 first:mt-0 first:border-0 first:pt-0">
        <p className="sr-only">{group.label}</p>
        {group.children.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  return (
    <section className="mt-5 first:mt-0">
      <button
        type="button"
        onClick={() => onToggleGroup(group.label)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
          active ? "text-slate-300" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
        } ${FOCUS}`}
      >
        <FontAwesomeIcon icon={group.icon} fixedWidth className="h-3 w-3" />
        <span className="flex-1 text-left">{group.label}</span>
        <span className="text-[10px] font-medium tabular-nums text-slate-600 group-hover:text-slate-400">
          {group.children.length}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`h-2.5 w-2.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <ul id={panelId} className="ml-[13px] mt-1 space-y-0.5 border-l border-white/[0.08] pl-2.5">
          {group.children.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} collapsed={false} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Sidebar({
  brand,
  subtitle,
  main,
  groups,
  pathname,
  collapsed,
  openGroups,
  onToggleGroup,
  onOpenPalette,
  onNavigate,
  onClose,
  userName,
  userRoleLabel,
  avatarSrc,
  profileTo,
  onLogout,
  homeTo,
}: SidebarProps) {
  const activeGroup = findActiveGroup(pathname, groups);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.07] ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        <Link
          to={homeTo}
          onClick={onNavigate}
          aria-label="Buka beranda workspace"
          className={`flex min-w-0 items-center gap-3 rounded-lg ${FOCUS}`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold tracking-tight text-white">
                RSV Helmet
              </span>
              <span className="mt-0.5 block truncate text-[9.5px] font-semibold uppercase tracking-[0.18em] text-accent-400">
                {brand} · {subtitle}
              </span>
            </span>
          )}
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Tutup navigasi"
            className={`ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white ${FOCUS}`}
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={`shrink-0 ${collapsed ? "px-2 pt-3" : "px-3 pt-3"}`}>
        <button
          type="button"
          onClick={onOpenPalette}
          title={collapsed ? "Cari menu (Ctrl+K)" : undefined}
          aria-label={collapsed ? "Cari menu" : undefined}
          className={`flex h-9 w-full items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[12.5px] text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-slate-100 ${FOCUS} ${
            collapsed ? "justify-center" : "gap-2 px-2.5"
          }`}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">Cari menu…</span>
              <kbd className="rounded border border-white/15 bg-white/5 px-1 py-0.5 font-sans text-[10px] font-medium text-slate-400">
                Ctrl K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav
        aria-label={`Navigasi ${brand.toLowerCase()}`}
        className={`shell-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-4 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        {main.length > 0 && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Utama
              </p>
            )}
            {main.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        )}

        {groups.map((group) => (
          <GroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            pathname={pathname}
            open={openGroups[group.label] ?? activeGroup?.label === group.label}
            onToggleGroup={onToggleGroup}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.07] p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Link
              to={profileTo}
              title={userName}
              aria-label={`Profil ${userName}`}
              className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full ring-2 ring-white/10 transition hover:ring-accent-500/60 ${FOCUS}`}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-navy-700 text-[11px] font-bold text-white">
                  {initialsFromName(userName)}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={onLogout}
              title="Keluar"
              aria-label="Keluar"
              className={`grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-red-300 ${FOCUS}`}
            >
              <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
            <div className="flex items-center gap-2.5">
              <Link
                to={profileTo}
                aria-label={`Buka profil ${userName}`}
                className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-white/10 transition hover:ring-accent-500/60 ${FOCUS}`}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-navy-700 text-[11px] font-bold text-white">
                    {initialsFromName(userName)}
                  </span>
                )}
              </Link>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[12.5px] font-semibold text-white">{userName}</p>
                <p className="truncate text-[10.5px] text-slate-400">{userRoleLabel}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Keluar"
                aria-label="Keluar"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-red-300 ${FOCUS}`}
              >
                <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-3.5 w-3.5" />
              </button>
            </div>
            <Link
              to="/"
              onClick={onNavigate}
              className={`mt-2 flex items-center justify-between rounded-lg border-t border-white/[0.06] pt-2 text-[11px] text-slate-500 transition-colors hover:text-accent-400 ${FOCUS}`}
            >
              <span>Beranda publik</span>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
