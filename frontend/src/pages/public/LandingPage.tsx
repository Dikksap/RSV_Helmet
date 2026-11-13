import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoUrl from "../../assets/logo.svg";
import helmetUrl from "../../assets/gambar_helm.png";
import { checkSession, clearAuth, getToken, getUser, isAuthenticated, logout } from "../../api/auth";
import { signOutFirebase } from "../../lib/firebase";
import { useStatusOptions } from "../../lib/useStatusOptions";
import { DUS_CAPACITY } from "../../lib/dus";

type Module = {
  title: string;
  desc: string;
  to: string;
  icon: ReactNode;
  /** Role yang boleh membuka modul. Kosong berarti publik. */
  roles?: string[];
  isPublic?: boolean;
};

type Accent = "cyan" | "amber" | "indigo";

type Section = { id: string; title: string; desc: string; accent: Accent; modules: Module[] };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  gudang: "Gudang",
  produksi: "Produksi",
  user: "Operator",
  supervisor: "Supervisor",
  qc: "Quality Control",
};

const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] ?? role : "");
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Operator";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]";

/* ==========================================================================
   Motion helpers
   ========================================================================== */

/**
 * Variabel inline untuk animate-on-scroll.
 * @param delay jeda mulai (ms) — dipakai untuk efek bertahap antar item
 * @param y     jarak geser vertikal awal (px)
 * @param scale skala awal (1 = tanpa penskalaan)
 */
function reveal(delay = 0, y = 18, scale = 1): CSSProperties {
  return {
    "--reveal-delay": `${delay}ms`,
    "--reveal-y": `${y}px`,
    "--reveal-scale": `${scale}`,
  } as CSSProperties;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Animate on scroll. Menandai setiap [data-reveal] di dalam root menjadi
 * `data-reveal="in"` begitu masuk viewport, lalu berhenti mengamatinya
 * (animasi hanya berjalan sekali, tidak berulang saat scroll naik-turun).
 */
function useRevealOnScroll(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const show = (el: Element) => el.setAttribute("data-reveal", "in");

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      targets.forEach(show);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [rootRef]);
}

/**
 * Progres scroll untuk progress bar di header (ditulis langsung ke DOM agar
 * tidak memicu re-render tiap frame) + status header "terangkat" saat discroll.
 */
function useScrollChrome(barRef: RefObject<HTMLSpanElement | null>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    let lifted = false;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`;

      const next = window.scrollY > 8;
      if (next !== lifted) {
        lifted = next;
        setScrolled(next);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [barRef]);

  return scrolled;
}

const ACCENT: Record<Accent, { rail: string; tile: string; label: string }> = {
  cyan: {
    rail: "bg-[#00A8E8]",
    tile: "bg-[#00A8E8]/10 text-[#0088C0] group-hover:bg-[#1E3A5F] group-hover:text-white",
    label: "text-[#0088C0]",
  },
  amber: {
    rail: "bg-[#F59E0B]",
    tile: "bg-[#F59E0B]/15 text-[#B45309] group-hover:bg-[#B45309] group-hover:text-white",
    label: "text-[#B45309]",
  },
  indigo: {
    rail: "bg-[#1E3A5F]",
    tile: "bg-[#1E3A5F]/10 text-[#1E3A5F] group-hover:bg-[#1E3A5F] group-hover:text-white",
    label: "text-[#1E3A5F]",
  },
};

const svg = (children: ReactNode, cls = "h-5 w-5") => (
  <svg
    className={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const QR_ICON = svg(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 20h3M20 17v1" />
  </>,
);

const ARROW_ICON = svg(<path d="M5 12h13M13 6l6 6-6 6" />, "h-4 w-4");
const CHEVRON_ICON = svg(<path d="M9 6l6 6-6 6" />, "h-4 w-4");
const LOCK_ICON = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
  </svg>
);
const CHECK_ICON = svg(<path d="M20 6L9 17l-5-5" />, "h-3.5 w-3.5");
const CLOSE_ICON = svg(<path d="M18 6L6 18M6 6l12 12" />, "h-5 w-5");

const OPERATOR_MODULES: Module[] = [
  {
    title: "Scan Barang",
    desc: "Pindai QR, ubah status, dan kelompokkan per dus.",
    to: "/scan-qr",
    roles: ["admin", "user"],
    icon: QR_ICON,
  },
  {
    title: "Cetak Label",
    desc: "Cetak label QR dan hangtag siap tempel.",
    to: "/cetak-label",
    roles: ["admin", "user"],
    icon: svg(
      <>
        <path d="M6 9V4h12v5" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" rx="1.5" />
      </>,
    ),
  },
  {
    title: "Permintaan Barang",
    desc: "Ajukan kebutuhan barang, tanpa perlu login.",
    to: "/permintaan-barang",
    isPublic: true,
    icon: svg(
      <>
        <path d="M9 3h6a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2z" />
        <path d="M8 12h8M8 16h5" />
      </>,
    ),
  },
];

const PRODUKSI_MODULES: Module[] = [
  {
    title: "Produksi",
    desc: "Catat hasil produksi harian dan pemakaian material.",
    to: "/produksi/home",
    roles: ["produksi", "admin"],
    icon: svg(
      <>
        <path d="M3 21h18" />
        <path d="M5 21V8l5 3V8l5 3V5l5 3v13" />
        <path d="M9 21v-4h6v4" />
      </>,
    ),
  },
];

const ADMIN_MODULES: Module[] = [
  {
    title: "Inventaris",
    desc: "Kelola master barang, stok, dan lokasi penyimpanan.",
    to: "/admin/barang",
    roles: ["admin"],
    icon: svg(
      <>
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </>,
    ),
  },
  {
    title: "Dashboard",
    desc: "Pantau stok, aktivitas, dan performa operasional.",
    to: "/admin/home",
    roles: ["admin"],
    icon: svg(
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>,
    ),
  },
];

const SECTIONS: Section[] = [
  {
    id: "operator",
    title: "Operator",
    desc: "Aktivitas harian di lapangan: pindai, cetak, dan ajukan permintaan.",
    accent: "cyan",
    modules: OPERATOR_MODULES,
  },
  {
    id: "produksi",
    title: "Produksi",
    desc: "Pencatatan hasil produksi dan pemakaian material.",
    accent: "amber",
    modules: PRODUKSI_MODULES,
  },
  {
    id: "admin",
    title: "Admin",
    desc: "Kendali penuh atas data inventaris dan laporan.",
    accent: "indigo",
    modules: ADMIN_MODULES,
  },
];

const CAPABILITIES = [
  {
    title: "Pelacakan per unit",
    desc: "Setiap helm punya kode QR sendiri, sehingga status barang bisa ditelusuri kapan saja.",
    icon: QR_ICON,
  },
  {
    title: "Label & hangtag",
    desc: "Cetak label QR maupun hangtag langsung dari aplikasi tanpa alat tambahan.",
    icon: svg(
      <>
        <path d="M6 9V4h12v5" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" rx="1.5" />
      </>,
    ),
  },
  {
    title: "Stok tersinkron",
    desc: "Stok produksi, gudang, dan permintaan barang tercatat dalam satu sistem.",
    icon: svg(
      <>
        <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2" />
        <path d="M21 3v5h-5M3 21v-5h5" />
      </>,
    ),
  },
];

function accessFor(m: Module, role: string | undefined): { locked: boolean; hint: string } {
  if (m.isPublic) return { locked: false, hint: "" };
  if (!role) return { locked: true, hint: "Login untuk membuka" };
  if (m.roles && !m.roles.includes(role)) {
    return { locked: true, hint: `Khusus ${m.roles.map(roleLabel).join(" · ")}` };
  }
  return { locked: false, hint: "" };
}

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "AD";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ModuleCard({
  m,
  locked,
  hint,
  accent,
  guest,
  delay = 0,
}: {
  m: Module;
  locked: boolean;
  hint: string;
  accent: Accent;
  guest: boolean;
  /** Jeda animate-on-scroll (ms) untuk efek bertahap. */
  delay?: number;
}) {
  const card = `group relative flex h-full flex-col gap-4 rounded-2xl border p-4 text-left no-underline transition duration-300 sm:p-5 ${FOCUS} ${
    locked
      ? "border-dashed border-[#DFE5EE] bg-[#F8FAFC]"
      : "border-[#E5E9F0] bg-white shadow-[0_1px_2px_rgba(15,28,46,0.04)] hover:-translate-y-1 hover:border-[#00A8E8]/45 hover:shadow-[0_22px_45px_-22px_rgba(15,28,46,0.4)]"
  } ${locked && guest ? "hover:border-[#00A8E8]/45 hover:bg-white" : ""}`;

  const motionProps = { "data-reveal": "", style: reveal(delay) } as const;

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition duration-300 motion-safe:group-hover:scale-105 motion-safe:group-hover:-rotate-3 ${
          locked ? "bg-slate-100 text-[#94A3B8]" : ACCENT[accent].tile
        }`}
      >
        {m.icon}
      </span>

      <div className="min-w-0">
        <h4 className={`text-[15px] font-semibold leading-snug ${locked ? "text-[#475569]" : "text-[#0F1C2E]"}`}>
          {m.title}
        </h4>
        <p className="mt-1 text-[13px] leading-relaxed text-[#64748B]">{m.desc}</p>
      </div>

      <span className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
            locked ? "text-[#64748B]" : ACCENT[accent].label
          }`}
        >
          {locked ? hint : "Buka modul"}
        </span>
        <span
          className={`grid h-6 w-6 place-items-center rounded-full transition duration-300 motion-safe:group-hover:translate-x-0.5 ${
            locked
              ? "bg-slate-100 text-[#94A3B8]"
              : "bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#00A8E8] group-hover:text-white"
          }`}
        >
          {locked ? LOCK_ICON : ARROW_ICON}
        </span>
      </span>
    </>
  );

  if (!locked) {
    return (
      <Link to={m.to} className={card} title={m.title} {...motionProps}>
        {content}
      </Link>
    );
  }

  if (guest) {
    return (
      <Link to="/login" className={card} title="Butuh login" {...motionProps}>
        {content}
      </Link>
    );
  }

  return (
    <div className={card} aria-disabled="true" {...motionProps}>
      {content}
    </div>
  );
}

function ModuleGroup({ section, role }: { section: Section; role: string | undefined }) {
  const headingId = `modul-${section.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)] lg:gap-8"
    >
      <div className="lg:pt-1.5" data-reveal="" style={reveal(0, 14)}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className={`h-5 w-1 rounded-full ${ACCENT[section.accent].rail}`} />
          <h3 id={headingId} className="text-base font-bold text-[#0F1C2E]">
            {section.title}
          </h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#64748B] ring-1 ring-[#E5E9F0]">
            {section.modules.length}
          </span>
        </div>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#64748B]">{section.desc}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {section.modules.map((m, i) => {
          const access = accessFor(m, role);
          return (
            <ModuleCard
              key={m.title}
              m={m}
              locked={access.locked}
              hint={access.hint}
              accent={section.accent}
              guest={!role}
              delay={80 + i * 80}
            />
          );
        })}
      </div>
    </section>
  );
}

function ScanSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"semua" | "dus">("semua");
  const { options, loading, error } = useStatusOptions();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(true, onClose);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const go = (status?: string) => {
    const q = new URLSearchParams();
    if (mode === "dus") q.set("mode", "dus");
    if (status) q.set("status", status);
    const qs = q.toString();
    navigate(qs ? `/scan-qr?${qs}` : "/scan-qr");
  };

  const optionCls = `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#F6F8FB] focus-visible:bg-[#F6F8FB] ${FOCUS}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1626]/60 backdrop-blur-sm motion-safe:animate-fade-in sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-sheet-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_-20px_rgba(11,22,38,0.5)] motion-safe:animate-sheet-in sm:max-w-lg sm:rounded-3xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#EEF2F7] px-5 py-4 sm:px-6 sm:py-5">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00A8E8]/10 text-[#0088C0]">
            {QR_ICON}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="scan-sheet-title" className="text-base font-bold text-[#0F1C2E]">
              Mulai scan barang
            </h2>
            <p className="mt-0.5 text-[13px] text-[#64748B]">Pilih mode pemindaian, lalu status tujuan.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F1C2E] ${FOCUS}`}
          >
            {CLOSE_ICON}
          </button>
        </div>

        <div className="px-5 pt-4 sm:px-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1" role="group" aria-label="Mode scan">
            {(["semua", "dus"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${FOCUS} ${
                  mode === m ? "bg-white text-[#0F1C2E] shadow-sm" : "text-[#64748B] hover:text-[#0F1C2E]"
                }`}
              >
                {m === "semua" ? "Semua Barang" : `Per Dus (${DUS_CAPACITY})`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-3 sm:px-4">
          <button type="button" onClick={() => go()} className={optionCls}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F6F8FB] ring-1 ring-inset ring-[#E5E9F0]">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#94A3B8]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#0F1C2E]">Tanpa status</span>
              <span className="block text-[11px] text-[#64748B]">Status dipilih di halaman scan</span>
            </span>
            <span className="text-[#CBD5E1] transition group-hover:text-[#0088C0]">{CHEVRON_ICON}</span>
          </button>

          {loading && (
            <div className="space-y-1 py-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-3 py-2.5">
                  <span className="h-9 w-9 rounded-lg bg-slate-100" />
                  <span className="h-3 flex-1 rounded-full bg-slate-100" />
                </div>
              ))}
              <span className="sr-only">Memuat status...</span>
            </div>
          )}

          {error && (
            <p role="alert" className="mx-3 my-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-[#EF4444]">
              {error}
            </p>
          )}

          {!loading &&
            options.map((o) => (
              <button key={o.value} type="button" onClick={() => go(o.value)} className={optionCls}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F6F8FB] ring-1 ring-inset ring-[#E5E9F0]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.warna ?? "#94A3B8" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0F1C2E]">{o.label}</span>
                  <span className="block truncate font-mono text-[11px] uppercase tracking-wide text-[#64748B]">
                    {o.value}
                  </span>
                </span>
                <span className="text-[#94A3B8] transition group-hover:text-[#0088C0]">{CHEVRON_ICON}</span>
              </button>
            ))}
        </div>

        <div className="border-t border-[#EEF2F7] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl bg-[#F1F5F9] px-4 py-3 text-sm font-semibold text-[#475569] transition hover:bg-slate-200 ${FOCUS}`}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | undefined>(() => getUser()?.role);
  const [scanOpen, setScanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const scrolled = useScrollChrome(progressRef);
  useRevealOnScroll(pageRef);

  const guest = !role;
  const user = role ? getUser() : null;
  const name = user?.name ?? "Operator";
  const dashboardTo =
    role === "admin" ? "/admin/home" : role === "gudang" ? "/gudang/home" : role === "produksi" ? "/produksi/home" : null;
  const workTo = dashboardTo ?? (role === "user" ? "/scan-qr" : null);
  const canOpenProfile = !!role && ["admin", "gudang", "user", "produksi", "qc"].includes(role);

  useEffect(() => {
    let cancelled = false;
    if (isAuthenticated()) {
      checkSession().then((fresh) => {
        if (cancelled) return;
        if (!fresh) clearAuth();
        setRole(fresh ?? undefined);
      });
    }
    const onStorage = () => setRole(getUser()?.role);
    window.addEventListener("storage", onStorage);
    window.addEventListener("rsv:auth-updated", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rsv:auth-updated", onStorage);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("motion-safe:scroll-smooth");
    return () => html.classList.remove("motion-safe:scroll-smooth");
  }, []);

  useEscape(menuOpen, () => setMenuOpen(false));

  const handleLogout = async () => {
    setMenuOpen(false);
    const token = getToken();
    if (token) await logout(token).catch(() => undefined);
    await signOutFirebase();
    clearAuth();
    setRole(undefined);
  };

  const startScan = () => {
    setMenuOpen(false);
    if (guest) navigate("/login");
    else setScanOpen(true);
  };

  return (
    <div
      ref={pageRef}
      className="reveal-scope flex min-h-dvh flex-col bg-[#F6F8FB] font-[Inter,sans-serif] text-[#0F1C2E] antialiased"
    >
      <a
        href="#konten"
        className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1E3A5F] shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Lewati ke konten
      </a>

      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ${
          scrolled
            ? "border-[#E5E9F0] bg-white/95 shadow-[0_14px_34px_-26px_rgba(15,28,46,0.55)]"
            : "border-[#E5E9F0]/80 bg-white/85"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:h-[72px]">
          <Link to="/" className={`flex items-center gap-2.5 rounded-lg ${FOCUS}`} aria-label="RSV Helmet — beranda">
            <img src={logoUrl} alt="" className="h-8 w-auto sm:h-9" />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-sm font-extrabold tracking-tight text-[#0F1C2E]">RSV HELMET</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#64748B]">
                Inventory System
              </span>
            </span>
          </Link>

          <nav aria-label="Navigasi halaman" className="ml-auto hidden items-center gap-1 lg:flex">
            {[
              { href: "#modul", label: "Modul" },
              { href: "#kapabilitas", label: "Kapabilitas" },
              { href: "#kontak", label: "Kontak" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] no-underline transition hover:bg-slate-100 hover:text-[#0F1C2E] ${FOCUS}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {role ? (
            <div className="relative ml-auto lg:ml-0">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Menu akun ${name}`}
                className={`flex items-center gap-2 rounded-full border border-[#E5E9F0] bg-white p-1 transition hover:border-[#00A8E8]/50 hover:shadow-sm sm:pr-2.5 ${FOCUS}`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1E3A5F] text-[11px] font-bold text-white">
                  {initials(name)}
                </span>
                <span className="hidden max-w-[130px] truncate text-sm font-semibold text-[#0F1C2E] sm:block">
                  {name}
                </span>
                <svg
                  className={`hidden h-4 w-4 text-[#94A3B8] transition-transform duration-200 sm:block ${menuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div
                    role="menu"
                    aria-label="Menu akun"
                    className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white py-1 shadow-[0_20px_50px_-15px_rgba(15,28,46,0.25)] motion-safe:animate-menu-in"
                  >
                    <div className="border-b border-[#EEF2F7] px-4 py-3">
                      <p className="truncate text-sm font-bold text-[#0F1C2E]">{name}</p>
                      {user?.email && <p className="truncate text-[11px] text-[#64748B]">{user.email}</p>}
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#047857]">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                        {roleLabel(role) || role}
                      </p>
                    </div>
                    {workTo && (
                      <Link
                        to={workTo}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#0F1C2E] no-underline transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                      >
                        <svg className="h-4 w-4 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <rect x="3" y="3" width="7" height="7" rx="1.5" />
                          <rect x="14" y="3" width="7" height="7" rx="1.5" />
                          <rect x="3" y="14" width="7" height="7" rx="1.5" />
                          <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                        {dashboardTo ? "Dashboard" : "Scan Barang"}
                      </Link>
                    )}
                    {canOpenProfile && (
                      <Link
                        to="/profil"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#0F1C2E] no-underline transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                      >
                        <svg className="h-4 w-4 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21a8 8 0 0 1 16 0" />
                        </svg>
                        Profil Saya
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 border-t border-[#EEF2F7] px-4 py-2.5 text-left text-sm text-[#EF4444] transition hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
                        <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={`ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white no-underline shadow-sm transition duration-200 hover:bg-[#0F1C2E] hover:shadow-md active:scale-[0.98] lg:ml-0 ${FOCUS}`}
            >
              Login
              {ARROW_ICON}
            </Link>
          )}
        </div>

        {/* Indikator progres baca — diskalakan langsung lewat ref tanpa re-render. */}
        <span
          ref={progressRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left bg-gradient-to-r from-[#00A8E8] via-[#38BDF8] to-[#7DD3FC]"
          style={{ transform: "scaleX(0)" }}
        />
      </header>

      <main id="konten" className="flex-1">
        <section className="relative isolate overflow-hidden bg-[#0B1626] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 80% 90% at 8% 0%, rgba(0,168,232,0.35), transparent 55%), radial-gradient(ellipse 70% 70% at 92% 12%, rgba(30,58,95,0.85), transparent 60%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
                maskImage: "radial-gradient(ellipse 85% 75% at 50% 10%, #000 35%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 10%, #000 35%, transparent 100%)",
              }}
            />
            <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[#00A8E8]/20 blur-3xl motion-safe:animate-drift" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-14 pt-11 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-12 lg:pb-20 lg:pt-20">
            <div>
              <span
                data-reveal=""
                style={reveal(0, 14)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${guest ? "bg-[#00A8E8]" : "bg-[#10B981]"} motion-safe:animate-pulse`}
                />
                {guest ? "Sistem Inventaris RSV Helmet" : `Sesi aktif · ${roleLabel(role) || role}`}
              </span>

              <h1
                data-reveal=""
                style={reveal(90, 20)}
                className="mt-5 text-balance text-[2rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[2.75rem] lg:text-[3rem]"
              >
                {guest ? (
                  <>
                    Inventaris helm,
                    <span className="block text-[#7DD3FC]">dari scan sampai label.</span>
                  </>
                ) : (
                  <>
                    <span className="block text-base font-semibold text-white/60 sm:text-lg">
                      Halo{firstName(name) !== "Operator" ? `, ${firstName(name)}` : ""} 👋
                    </span>
                    <span className="mt-1 block break-words">Mau mulai dari mana?</span>
                  </>
                )}
              </h1>

              <p data-reveal="" style={reveal(170, 16)} className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
                {guest
                  ? "Masuk untuk memindai barang, mencetak label, dan memantau stok produksi. Permintaan barang bisa diajukan tanpa akun."
                  : "Pindai barang, cetak label, atau ajukan permintaan — semuanya dari satu tempat."}
              </p>

              <div data-reveal="" style={reveal(250, 16)} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={startScan}
                  className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00A8E8] to-[#38BDF8] px-6 text-[15px] font-bold text-[#062033] shadow-[0_10px_30px_-10px_rgba(0,168,232,0.8)] transition duration-200 hover:brightness-105 hover:shadow-[0_16px_34px_-12px_rgba(0,168,232,0.9)] active:scale-[0.98] sm:w-auto ${FOCUS}`}
                >
                  {guest ? (
                    <>
                      Masuk ke sistem
                      {ARROW_ICON}
                    </>
                  ) : (
                    <>
                      {QR_ICON}
                      Scan Barang
                    </>
                  )}
                </button>
                <Link
                  to="/permintaan-barang"
                  className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-6 text-[15px] font-semibold text-white no-underline backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10 active:translate-y-0 active:scale-[0.98] sm:w-auto ${FOCUS}`}
                >
                  Permintaan Barang
                </Link>
              </div>

              <ul data-reveal="" style={reveal(330, 14)} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-white/55">
                {["QR & barcode", "Cetak label", "Stok tersinkron"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <span className="text-[#00A8E8]">{CHECK_ICON}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              data-reveal=""
              style={reveal(220, 26, 0.98)}
              className="relative mx-auto hidden w-full max-w-sm lg:block"
            >
              <div
                aria-hidden="true"
                className="absolute inset-8 rounded-[2rem] bg-[#00A8E8]/25 blur-3xl motion-safe:animate-pulse"
              />
              <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.07] p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-md">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 50% 45%, rgba(125,211,252,0.22), transparent 60%)",
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 motion-safe:animate-ring"
                />
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08] motion-safe:animate-ring"
                  style={{ animationDelay: "-3.5s" }}
                />

                <img
                  src={helmetUrl}
                  alt=""
                  width={278}
                  height={216}
                  className="relative mx-auto w-56 max-w-full invert drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)] motion-safe:animate-float"
                />

                <div className="relative mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B1626]/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">RSV Helmet</p>
                    <p className="truncate text-sm font-semibold text-white">Inventory & Produksi</p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#00A8E8]/15 text-[#7DD3FC]">
                    {QR_ICON}
                  </span>
                </div>
              </div>

              <div
                className="absolute -left-5 top-10 flex items-center gap-2 rounded-xl border border-white/12 bg-[#0B1626]/85 px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl backdrop-blur motion-safe:animate-float-slow"
                style={{ animationDelay: "-1.2s" }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#00A8E8]/15 text-[#38BDF8]">{QR_ICON}</span>
                Scan QR
              </div>
              <div
                className="absolute -right-5 bottom-32 flex items-center gap-2 rounded-xl border border-white/12 bg-[#0B1626]/85 px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl backdrop-blur motion-safe:animate-float-slow"
                style={{ animationDelay: "-5s" }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F59E0B]/15 text-[#FBBF24]">
                  {CAPABILITIES[1].icon}
                </span>
                Cetak hangtag
              </div>
            </div>
          </div>
        </section>

        <section id="modul" aria-labelledby="modul-heading" className="scroll-mt-24 bg-[#F6F8FB] py-10 sm:py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div data-reveal="" style={reveal(0, 14)} className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00A8E8]">Modul</p>
                <h2 id="modul-heading" className="mt-1.5 text-xl font-bold tracking-tight text-[#0F1C2E] sm:text-2xl">
                  {guest ? "Modul yang tersedia" : `Modul untuk ${roleLabel(role) || "Anda"}`}
                </h2>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-[#64748B]">
                {guest
                  ? "Sebagian modul memerlukan akun. Permintaan barang tetap bisa diajukan tanpa login."
                  : "Modul dengan tanda gembok belum tersedia untuk peran Anda saat ini."}
              </p>
            </div>

            <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-7">
              {SECTIONS.map((section) => (
                <ModuleGroup key={section.id} section={section} role={role} />
              ))}
            </div>
          </div>
        </section>

        <section
          id="kapabilitas"
          aria-labelledby="kapabilitas-heading"
          className="scroll-mt-24 border-t border-[#E5E9F0] bg-white py-12 sm:py-16"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div data-reveal="" style={reveal(0, 14)} className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00A8E8]">Kapabilitas</p>
              <h2 id="kapabilitas-heading" className="mt-1.5 text-xl font-bold tracking-tight text-[#0F1C2E] sm:text-2xl">
                Dirancang mengikuti alur kerja gudang
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                Dari barang masuk sampai siap kirim, setiap langkah tercatat dalam satu sistem.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
              {CAPABILITIES.map((c, i) => (
                <article
                  key={c.title}
                  data-reveal=""
                  style={reveal(80 + i * 90, 22)}
                  className="group rounded-2xl border border-[#E5E9F0] bg-[#FBFCFE] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#00A8E8]/40 hover:bg-white hover:shadow-[0_22px_44px_-24px_rgba(15,28,46,0.38)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1E3A5F]/[0.07] text-[#1E3A5F] transition duration-300 group-hover:bg-[#1E3A5F] group-hover:text-white motion-safe:group-hover:scale-105 motion-safe:group-hover:-rotate-3">
                    {c.icon}
                  </span>
                  <h3 className="mt-3.5 text-sm font-bold text-[#0F1C2E]">{c.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B]">{c.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="kontak" className="scroll-mt-24 bg-[#0B1626] text-white/65">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-10 lg:py-14">
          <div data-reveal="" style={reveal(0, 16)}>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-white p-1.5">
                <img src={logoUrl} alt="" className="h-7 w-auto" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-sm font-extrabold tracking-tight text-white">RSV HELMET</span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  Inventory System
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed">
              Sistem inventaris internal untuk memantau pergerakan barang, produksi, dan permintaan gudang.
            </p>
          </div>

          <nav aria-label="Tautan footer" data-reveal="" style={reveal(90, 16)} className="text-[13px]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Navigasi</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#modul" className={`rounded text-inherit no-underline transition hover:text-white ${FOCUS}`}>
                  Modul
                </a>
              </li>
              <li>
                <a href="#kapabilitas" className={`rounded text-inherit no-underline transition hover:text-white ${FOCUS}`}>
                  Kapabilitas
                </a>
              </li>
              <li>
                <Link to="/permintaan-barang" className={`rounded text-inherit no-underline transition hover:text-white ${FOCUS}`}>
                  Permintaan Barang
                </Link>
              </li>
              <li>
                <Link
                  to={role ? "/" : "/login"}
                  className={`rounded text-inherit no-underline transition hover:text-white ${FOCUS}`}
                >
                  {role ? "Beranda" : "Login"}
                </Link>
              </li>
            </ul>
          </nav>

          <div data-reveal="" style={reveal(180, 16)} className="text-[13px]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Kontak</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="mailto:info@rsvhelmet.com" className={`rounded text-inherit no-underline transition hover:text-white ${FOCUS}`}>
                  info@rsvhelmet.com
                </a>
              </li>
              <li className="text-white/55">Bantuan akses &amp; akun</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-4 py-5 text-[11px] text-white/55 sm:flex-row sm:items-center sm:px-6">
            <p>© {new Date().getFullYear()} RSV Helmet · Sistem Inventaris</p>
            <p>Internal use only</p>
          </div>
        </div>
      </footer>

      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
    </div>
  );
}

export default LandingPage;
