import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faBars,
  faChevronRight,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

import { NotificationCenter } from "../admin/NotificationCenter";
import { UserMenu } from "./UserMenu";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60";

export interface TopbarProps {
  pageTitle: string;
  groupLabel?: string;
  roleLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
  userName: string;
  userEmail?: string;
  userRoleLabel: string;
  avatarSrc: string | null;
  profileTo: string;
  onLogout: () => void;
}

export function Topbar({
  pageTitle,
  groupLabel,
  roleLabel,
  collapsed,
  onToggleCollapsed,
  onOpenDrawer,
  onOpenPalette,
  userName,
  userEmail,
  userRoleLabel,
  avatarSrc,
  profileTo,
  onLogout,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka navigasi"
          className={`-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy-900 lg:hidden ${FOCUS}`}
        >
          <FontAwesomeIcon icon={faBars} className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          aria-expanded={!collapsed}
          className={`-ml-1 hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-900 lg:grid ${FOCUS}`}
        >
          <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1 py-1">
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex">
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {roleLabel}
            </span>
            <FontAwesomeIcon icon={faChevronRight} className="h-2 w-2 shrink-0 text-slate-300" />
            {groupLabel && (
              <>
                <span className="truncate text-[11.5px] text-slate-500">{groupLabel}</span>
                <FontAwesomeIcon icon={faChevronRight} className="h-2 w-2 shrink-0 text-slate-300" />
              </>
            )}
            <span className="truncate text-[12.5px] font-semibold text-navy-900">{pageTitle}</span>
          </nav>
          <p className="truncate text-[15px] font-semibold text-navy-900 md:hidden">{pageTitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onOpenPalette}
            className={`hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 text-[12px] text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-navy-900 md:flex ${FOCUS}`}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Cari menu</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1 py-0.5 font-sans text-[10px] font-medium text-slate-400 lg:inline">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Cari menu"
            className={`grid h-10 w-10 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy-900 md:hidden ${FOCUS}`}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4" />
          </button>

          <NotificationCenter />

          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

          <UserMenu
            name={userName}
            email={userEmail}
            roleLabel={userRoleLabel}
            avatarSrc={avatarSrc}
            profileTo={profileTo}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}
