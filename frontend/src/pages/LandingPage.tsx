import { useEffect } from "react";
import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";

const NAV = [
  { label: "Layanan", href: "#layanan" },
  { label: "Tentang", href: "#tentang" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Testimoni", href: "#testimoni" },
  { label: "Kontak", href: "#kontak" },
];

const SERVICES = [
  {
    title: "Cetak Label QR",
    desc: "Cetak label kode barang QR untuk setiap item secara massal, akurat, dan presisi tinggi.",
    to: "/cetak_barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 8h3v8H7zM14 8h3v5h-3zM10 16h4" />
      </svg>
    ),
  },
  {
    title: "Integrasi Printer",
    desc: "Integrasi langsung ke printer thermal dengan kalibrasi ukuran dan multi-format label.",
    to: "/print_manager",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 9V4h12v5" />
        <rect x="6" y="11" width="12" height="8" rx="1" />
        <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    title: "Lacak Inventaris",
    desc: "Pantau lokasi & riwayat pergerakan barang real-time di dashboard terpusat.",
    to: "/admin/dashboard",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0" />
        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
      </svg>
    ),
  },
  {
    title: "Manajemen Stok",
    desc: "Kelola stok dengan auto-update dan perencanaan replenishment terintegrasi.",
    to: "/admin/barang",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
];

const CASES = [
  { tag: "Gudang Pusat", title: "10K+ label tercetak tanpa salah potong", desc: "Kalibrasi thermal presisi + format hangtag custom per varian helm." },
  { tag: "Operasional Toko", title: "Scan < 2 detik per item", desc: "QR terenkripsi mempercepat stock opname dan serah terima." },
  { tag: "Audit Stok", title: "Selisih stok turun 92%", desc: "Riwayat pergerakan real-time, lokasi rak terpantau penuh." },
];

const TESTIMONIALS = [
  { name: "Andi Pratama", role: "Kepala Gudang", text: "Cetak massal jadi jauh lebih cepat. Kalibrasi labelnya akurat, tidak ada lagi yang terpotong." },
  { name: "Sari Dewi", role: "Admin Inventaris", text: "Dashboard-nya jelas. Lacak lokasi barang per rak sangat membantu saat audit." },
  { name: "Budi Santoso", role: "Owner", text: "Uptime stabil, tim cepat adaptasi. Investasi yang balik dalam hitungan minggu." },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("revealed")),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function LandingPage() {
  const year = new Date().getFullYear();
  useReveal();

  return (
    <div className="min-h-screen bg-white text-[#1F2937] antialiased">
      <main>
        {/* 5.2 Hero */}
        <section className="relative overflow-hidden bg-[#0F1C2E]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#0F1C2E] to-[#0F1C2E]" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(0,168,232,0.18),transparent_50%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1280px] gap-12 px-6 py-16 md:px-12 md:py-24 lg:grid-cols-2 lg:items-center">
            <div className="reveal">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" aria-hidden="true" />
                Sistem Operasional RSV Helmet
              </p>
              <h1 className="mt-6 text-[32px] font-bold leading-[1.2] text-white md:text-5xl">
                Solusi Inventaris Modern &amp; Terintegrasi
              </h1>
              <p className="mt-5 max-w-xl text-base leading-[1.6] text-slate-300 md:text-lg">
                Generate barcode, cetak hangtag presisi, dan pantau stok secara real-time dalam satu platform terpusat untuk operasional gudang yang cepat dan akurat.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/cetak_barang" className="rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white transition-all duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Mulai Cetak Label
                </Link>
                <Link to="/scan-qr" className="rounded-lg border-2 border-white/40 px-6 py-3 text-base font-medium text-white transition-all duration-200 hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Scan Barang
                </Link>
              </div>
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
                {[["10K+", "Barang tercatat"], ["< 2 dtk", "Waktu scan"], ["99,9%", "Uptime server"]].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="text-xl font-bold text-white">{v}</dd>
                    <dd className="text-sm text-slate-400">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="reveal rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <p className="text-sm font-medium text-white">RSV-A01-BLK — Full Face</p>
                <span className="rounded-full bg-[#10B981]/15 px-3 py-1 text-xs font-semibold text-[#10B981]">✓ Terverifikasi</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                {[["Lokasi", "Rak A-12"], ["Stok", "24 unit"], ["Status cetak", "Hangtag OK"], ["Update", "Real-time"]].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="mt-1 font-medium text-white">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link to="/admin/dashboard" className="mt-6 block rounded-lg bg-white px-6 py-3 text-center text-[15px] font-medium text-[#1E3A5F] transition-colors duration-200 hover:bg-[#F5F7FA]">
                Buka Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="layanan" aria-labelledby="layanan-h" className="bg-[#F5F7FA]">
          <div className="reveal mx-auto max-w-[1280px] px-6 py-16 md:px-12 md:py-24">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#00A8E8]">Layanan</p>
            <h2 id="layanan-h" className="mt-2 text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">Fitur operasional end-to-end</h2>
            <p className="mt-3 max-w-2xl text-base leading-[1.6] text-[#6B7280]">Empat modul inti yang dirancang untuk kecepatan, akurasi, dan kemudahan pakai.</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <Link key={s.title} to={s.to} className="group rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] focus-visible:outline-2 focus-visible:outline-[#00A8E8]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E3A5F]/5 text-[#1E3A5F] transition-colors duration-200 group-hover:bg-[#00A8E8] group-hover:text-white">
                    {s.icon}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold leading-[1.4]">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-[#6B7280]">{s.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#00A8E8]">Buka modul <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* About ringkas */}
        <section id="tentang" aria-labelledby="tentang-h" className="bg-white">
          <div className="reveal mx-auto grid max-w-[1280px] gap-10 px-6 py-16 md:px-12 md:py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#00A8E8]">Tentang Kami</p>
              <h2 id="tentang-h" className="mt-2 text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">Dibangun untuk gudang yang tidak boleh salah</h2>
              <p className="mt-4 text-base leading-[1.6] text-[#6B7280] md:text-lg">
                RSV Helmet menggabungkan pencetakan label presisi, sinkronisasi stok otomatis, dan pelacakan real-time — mengurangi selisih stok dan mempercepat audit harian.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] text-[#1F2937]">
                {["QR terenkripsi per item, anti-duplikat", "Kalibrasi thermal per ukuran hangtag", "Riwayat pergerakan + lokasi rak"].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/15 text-xs font-bold text-[#10B981]" aria-hidden="true">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link to="/admin/dashboard" className="mt-8 inline-block rounded-lg border-2 border-[#1E3A5F] px-6 py-3 text-[15px] font-medium text-[#1E3A5F] transition-colors duration-200 hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]">
                Lihat Cara Kerja
              </Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[["01", "Generate", "Pilih varian & buat kode unik"], ["02", "Cetak", "Kirim ke thermal, format custom"], ["03", "Lacak", "Pantau lokasi real-time"]].map(([n, t, d]) => (
                <li key={n} className="rounded-xl bg-[#F5F7FA] p-6">
                  <p className="text-sm font-bold tracking-widest text-[#00A8E8]">{n}</p>
                  <p className="mt-1 font-semibold">{t}</p>
                  <p className="mt-1 text-sm leading-[1.5] text-[#6B7280]">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Portfolio */}
        <section id="portfolio" aria-labelledby="portfolio-h" className="bg-[#F5F7FA]">
          <div className="reveal mx-auto max-w-[1280px] px-6 py-16 md:px-12 md:py-24">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#00A8E8]">Portfolio</p>
            <h2 id="portfolio-h" className="mt-2 text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">Studi kasus lapangan</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {CASES.map((c) => (
                <article key={c.title} className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                  <p className="inline-block rounded-full bg-[#1E3A5F]/5 px-3 py-1 text-xs font-semibold text-[#1E3A5F]">{c.tag}</p>
                  <h3 className="mt-3 text-xl font-semibold leading-[1.4]">{c.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-[#6B7280]">{c.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimoni" aria-labelledby="testimoni-h" className="bg-white">
          <div className="reveal mx-auto max-w-[1280px] px-6 py-16 md:px-12 md:py-24">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#00A8E8]">Testimoni</p>
              <h2 id="testimoni-h" className="mt-2 text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">Dipercaya tim operasional</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="rounded-xl bg-[#F5F7FA] p-6">
                  <blockquote className="text-[15px] leading-[1.6] text-[#1F2937]">“{t.text}”</blockquote>
                  <figcaption className="mt-4">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-[#6B7280]">{t.role}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-h" className="bg-white px-6 pb-16 md:px-12 md:pb-24">
          <div className="reveal mx-auto max-w-[1280px] rounded-xl bg-[#1E3A5F] px-6 py-12 text-center md:py-16">
            <h2 id="cta-h" className="mx-auto max-w-2xl text-[28px] font-semibold leading-[1.3] text-white md:text-4xl">Siap meningkatkan efisiensi gudang Anda?</h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-[1.6] text-slate-300">Mulai cetak label hari ini. Gratis onboarding untuk tim RSV Helmet.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/login" className="rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Mulai Sekarang
              </Link>
              <a href="mailto:info@rsvhelmet.com" className="rounded-lg border-2 border-white/40 px-6 py-3 text-base font-medium text-white transition-colors duration-200 hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Hubungi Sales
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 5.6 Footer — 4 kolom, dark */}
      <footer id="kontak" className="bg-[#0F1C2E] text-slate-300">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-2 md:px-12 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Logo RSV Helmet" className="h-8 w-8 object-contain brightness-0 invert" />
              <span className="font-bold text-white">RSV HELMET</span>
            </div>
            <p className="mt-4 text-sm leading-[1.6] text-slate-400">Sistem inventaris & pencetakan label terintegrasi untuk operasional gudang modern.</p>
          </div>
          <nav aria-label="Navigasi footer">
            <p className="font-semibold text-white">Navigasi</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV.map((n) => (
                <li key={n.label}><a href={n.href} className="transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-[#00A8E8]">{n.label}</a></li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="font-semibold text-white">Kontak</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="mailto:info@rsvhelmet.com" className="transition-colors duration-200 hover:text-white">info@rsvhelmet.com</a></li>
              <li><Link to="/login" className="transition-colors duration-200 hover:text-white">Masuk dashboard</Link></li>
              <li><Link to="/scan-qr" className="transition-colors duration-200 hover:text-white">Scan barang</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">Modul</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/cetak_barang" className="transition-colors duration-200 hover:text-white">Cetak label</Link></li>
              <li><Link to="/print_manager" className="transition-colors duration-200 hover:text-white">Print manager</Link></li>
              <li><Link to="/admin/barang" className="transition-colors duration-200 hover:text-white">Inventaris</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-[1280px] px-6 py-5 text-center text-[13px] text-slate-500 md:px-12">© {year} RSV Helmet Operational System. All rights reserved.</p>
        </div>
      </footer>

      <style>{`.reveal{opacity:0;transform:translateY(16px);transition:opacity .2s ease,transform .2s ease}.reveal.revealed{opacity:1;transform:none}@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}`}</style>
    </div>
  );
}

export default LandingPage;
