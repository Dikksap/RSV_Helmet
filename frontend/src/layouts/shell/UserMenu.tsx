import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faChevronDown,
  faUserPen,
} from "@fortawesome/free-solid-svg-icons";

import { initialsFromName } from "./nav-utils";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60";

export interface UserMenuProps {
  name: string;
  email?: string;
  roleLabel: string;
  avatarSrc: string | null;
  profileTo: string;
  onLogout: () => void;
}

export function UserMenu({ name, email, roleLabel, avatarSrc, profileTo, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu akun ${name}`}
        className={`flex items-center gap-2 rounded-full border border-transparent p-1 transition-colors hover:border-slate-200 hover:bg-slate-50 sm:pr-2.5 ${FOCUS}`}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-600 text-[11px] font-bold text-white ring-2 ring-white">
            {initialsFromName(name)}
          </span>
        )}
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[150px] truncate text-[12.5px] font-semibold text-navy-900">
            {name}
          </span>
          <span className="block truncate text-[10.5px] text-slate-500">{roleLabel}</span>
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`hidden h-2.5 w-2.5 text-slate-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label="Menu akun"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_-18px_rgba(8,17,29,0.35)]"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-[13px] font-semibold text-navy-900">{name}</p>
              {email && <p className="truncate text-[11px] text-slate-500">{email}</p>}
              <span className="mt-2 inline-flex items-center rounded-md bg-accent-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-600">
                {roleLabel}
              </span>
            </div>
            <Link
              to={profileTo}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 no-underline transition-colors hover:bg-slate-50 hover:text-navy-900 ${FOCUS}`}
            >
              <FontAwesomeIcon icon={faUserPen} className="h-3.5 w-3.5 text-slate-400" />
              Profil saya
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className={`flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50 ${FOCUS}`}
            >
              <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
