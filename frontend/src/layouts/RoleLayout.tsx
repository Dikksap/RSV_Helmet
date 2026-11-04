import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

import { checkSession, clearAuth, getProfileAvatar, getToken, getUser, logout } from "../api/auth";
import type { User } from "../api/auth";
import { signOutFirebase } from "../lib/firebase";

import { CommandPalette } from "./shell/CommandPalette";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { buildPaletteEntries, findActiveGroup, findActiveItem, findLooseMatch } from "./shell/nav-utils";

export type NavItem = { to: string; label: string; icon: IconDefinition; end?: boolean; description?: string };
export type NavGroup = { label: string; icon: IconDefinition; children: NavItem[] };

export interface RoleLayoutProps {
  role: string;
  allowedRoles?: string[];
  profileTo?: string;
  subheader?: ReactNode;
  brand: string;
  subtitle: string;
  titleFallback: string;
  main: NavItem[];
  groups: NavGroup[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  gudang: "Warehouse",
  produksi: "Produksi",
  qc: "QC",
  user: "Operator",
  supervisor: "Supervisor",
};

function collapseKey(role: string) {
  return `rsv_${role}_sidebar_collapsed`;
}

function groupsKey(role: string) {
  return `rsv_${role}_sidebar_groups`;
}

function readOpenGroups(role: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(groupsKey(role));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

function RoleLayout({
  role,
  allowedRoles,
  profileTo,
  subheader,
  brand,
  subtitle,
  titleFallback,
  main,
  groups,
}: RoleLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const allowed = useMemo(() => allowedRoles ?? [role], [allowedRoles, role]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [user, setUser] = useState<User | null>(() => getUser());
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [avatarRefresh, setAvatarRefresh] = useState(0);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(collapseKey(role)) === "1");
  const [hovered, setHovered] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readOpenGroups(role));
  const effectiveCollapsed = collapsed && !hovered;

  useEffect(() => {
    const refreshUser = () => setUser(getUser());
    const refreshAvatar = () => {
      setAvatarSrc(null);
      setAvatarRefresh((current) => current + 1);
    };
    window.addEventListener("rsv:auth-updated", refreshUser);
    window.addEventListener("rsv:avatar-updated", refreshAvatar);
    return () => {
      window.removeEventListener("rsv:auth-updated", refreshUser);
      window.removeEventListener("rsv:avatar-updated", refreshAvatar);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!user?.avatarUrl) {
      return () => {
        active = false;
      };
    }
    void getProfileAvatar()
      .then((blob) => {
        if (!active) return;
        objectUrl = blob ? URL.createObjectURL(blob) : null;
        setAvatarSrc(objectUrl);
      })
      .catch((error: unknown) => {
        if (active) console.error("Gagal memuat avatar header:", error);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.avatarUrl, avatarRefresh]);

  useEffect(() => {
    if (!allowed.includes(getUser()?.role ?? "")) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    checkSession().then((current) => {
      if (cancelled || (current && allowed.includes(current))) return;
      clearAuth();
      navigate("/login?session=expired", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [allowed, navigate, pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tutup drawer/palette setiap kali halaman berubah
    setDrawerOpen(false);
    setPaletteOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      localStorage.setItem(collapseKey(role), current ? "0" : "1");
      return !current;
    });

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => {
      const activeGroup = findActiveGroup(pathname, groups);
      const open = current[label] ?? activeGroup?.label === label;
      const next = { ...current, [label]: !open };
      localStorage.setItem(groupsKey(role), JSON.stringify(next));
      return next;
    });
  };

  const userName = user?.name ?? `${titleFallback} RSV`;
  const userRoleLabel = ROLE_LABELS[user?.role ?? ""] ?? (user?.role ?? titleFallback);
  const looseMatch = findLooseMatch(pathname, main, groups);
  const activeItem = findActiveItem(pathname, main, groups) ?? looseMatch?.item;
  const activeGroup = findActiveGroup(pathname, groups) ?? looseMatch?.group;
  const isProfileRoute = /\/profil\/?$/.test(pathname);
  const pageTitle = isProfileRoute ? "Profil Saya" : (activeItem?.label ?? titleFallback);
  const resolvedProfileTo = profileTo ?? `/${role}/profil`;
  const homeTo = main[0]?.to ?? "/";
  const paletteEntries = useMemo(() => buildPaletteEntries(main, groups), [main, groups]);

  const handleLogout = async () => {
    const token = getToken();
    if (token) await logout(token).catch(() => undefined);
    await signOutFirebase();
    clearAuth();
    navigate("/login", { replace: true });
  };

  if (!allowed.includes(user?.role ?? "")) return <Navigate to="/login" replace />;

  const sidebar = (isCollapsed: boolean, options?: { onClose?: () => void }) => (
    <Sidebar
      brand={brand}
      subtitle={subtitle}
      main={main}
      groups={groups}
      pathname={pathname}
      collapsed={isCollapsed}
      openGroups={openGroups}
      onToggleGroup={toggleGroup}
      onOpenPalette={() => setPaletteOpen(true)}
      onNavigate={() => setDrawerOpen(false)}
      onClose={options?.onClose}
      userName={userName}
      userRoleLabel={userRoleLabel}
      avatarSrc={avatarSrc}
      profileTo={resolvedProfileTo}
      onLogout={() => void handleLogout()}
      homeTo={homeTo}
    />
  );

  return (
    <div className="app-admin min-h-screen w-full font-sans text-slate-800 antialiased">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>

      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden transition-[width] duration-200 ease-out lg:flex ${
          effectiveCollapsed ? "w-[76px]" : "w-[272px]"
        }`}
      >
        {sidebar(effectiveCollapsed)}
      </aside>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Navigasi ${titleFallback.toLowerCase()}`}
        >
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="app-shell-sidebar absolute inset-y-0 left-0 flex w-[min(86vw,304px)] flex-col">
            {sidebar(false, { onClose: () => setDrawerOpen(false) })}
          </div>
        </div>
      )}

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ease-out ${
          collapsed ? "lg:pl-[76px]" : "lg:pl-[272px]"
        }`}
      >
        <Topbar
          pageTitle={pageTitle}
          groupLabel={activeGroup?.label}
          roleLabel={ROLE_LABELS[user?.role ?? ""] ?? userRoleLabel}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          userName={userName}
          userEmail={user?.email}
          userRoleLabel={userRoleLabel}
          avatarSrc={avatarSrc}
          profileTo={resolvedProfileTo}
          onLogout={() => void handleLogout()}
        />

        {subheader && (
          <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">{subheader}</div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pb-12 pt-6 focus-visible:outline-none sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-[1560px]">
            <Outlet />
          </div>
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette entries={paletteEntries} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}

export default RoleLayout;
