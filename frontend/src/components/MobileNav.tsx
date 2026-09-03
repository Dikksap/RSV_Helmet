import { NavLink } from "react-router-dom";
import { isAuthenticated, isAdmin } from "../api/auth";
import { useState, useEffect } from "react";

function MobileNav() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  useEffect(() => {
    const id = setInterval(() => setAuthenticated(isAuthenticated()), 1000);
    return () => clearInterval(id);
  }, []);

  const icHome = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
  const icGenerate = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h3v8H7zM14 8h3v5h-3z" />
    </svg>
  );
  const icPrinter = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V4h12v5" />
      <rect x="6" y="11" width="12" height="8" rx="1" />
      <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    </svg>
  );
  const icQr = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
    </svg>
  );
  const icAdmin = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
      <path d="M17 21v-2a4 4 0 0 0-4-4H11a4 4 0 0 0-4 4v2" />
    </svg>
  );

  const NAV_ITEMS = [
    { to: "/", label: "Home", end: true, icon: icHome },
    { to: "/cetak_barang", label: "Generate", end: false, icon: icGenerate },
    { to: "/scan-qr", label: "Scan QR", end: false, icon: icQr },
    { to: "/print_manager", label: "Printer", end: false, icon: icPrinter },
  ];

  if (authenticated && isAdmin()) {
    NAV_ITEMS.push({ to: "/admin/dashboard", label: "Admin", end: false, icon: icAdmin });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-2xl backdrop-blur-xl">
        <nav className="flex items-center justify-around p-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 transition-all duration-200 min-w-[64px]",
                  isActive
                    ? "text-zinc-950 bg-zinc-100 scale-105"
                    : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50",
                ].join(" ")
              }
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default MobileNav;
