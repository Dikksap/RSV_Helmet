import { Link, Outlet, useLocation } from "react-router-dom";
import logoUrl from "../assets/logo.svg";

const HIDE_TOPBAR = new Set(["/", "/live-view", "/login"]);

function PublicLayout() {
  const { pathname } = useLocation();
  const showTopbar = !HIDE_TOPBAR.has(pathname);

  return (
    <div className="app-public flex min-h-screen min-h-dvh flex-col text-zinc-950">
      {showTopbar && (
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-white/40 bg-white/60 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white/70 hover:text-slate-900"
            >
              <span aria-hidden="true">←</span> Beranda
            </Link>
            <span className="ml-auto flex items-center gap-2">
              <img src={logoUrl} alt="RSV" className="h-7 w-7 object-contain" />
              <span className="hidden text-sm font-bold sm:block">RSV Helmet</span>
            </span>
          </div>
        </header>
      )}
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}

export default PublicLayout;
