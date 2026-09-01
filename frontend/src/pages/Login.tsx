import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setAuth, isAuthenticated } from "../api/auth";
import logoUrl from "../assets/logo.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await login({ email, password });
      setAuth(response.token, response.user);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — brand hero (desktop) */}
        <div className="relative hidden overflow-hidden bg-zinc-900 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

          <div className="relative p-10">
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-zinc-900 shadow-sm">
                <img src={logoUrl} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
              </span>
              <span className="text-sm font-black tracking-tight">RSV HELMET</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-bold tracking-wide">Inventory</span>
            </Link>
          </div>

          <div className="relative px-10 pb-10">
            <div className="max-w-md">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Sistem Operasional Aktif
              </p>
              <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight text-white">
                Kelola
                <br />
                Inventaris
                <br />
                <span className="text-zinc-400">dengan Presisi.</span>
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Generate barang, cetak hangtag thermal, dan lacak stok secara realtime dalam satu dashboard terpadu.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xl font-black text-white">10k+</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Barang</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xl font-black text-white">&lt;2s</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Generate</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xl font-black text-white">99.9%</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Akurat</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10 px-10 py-6">
            <p className="text-xs font-medium text-zinc-500">© 2024 RSV Helmet. All Rights Reserved. • Secure • Fast • Reliable</p>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col">
          {/* Mobile top bar */}
          <div className="flex items-center justify-between px-6 py-5 lg:hidden">
            <Link to="/" className="flex items-center gap-2 text-zinc-900">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 shadow-sm">
                <img src={logoUrl} alt="" className="h-6 w-6 object-contain brightness-0 invert" />
              </span>
              <span className="text-sm font-black tracking-tight">RSV HELMET</span>
            </Link>
            <Link to="/" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
              ← Home
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-12">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <div className="hidden lg:flex">
                  <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                    <span>←</span> Kembali ke Home
                  </Link>
                </div>
                <div className="mt-6 flex justify-center lg:hidden">
                  <img src={logoUrl} alt="" className="h-12 w-12 object-contain" />
                </div>
                <h1 className="mt-6 text-center text-2xl font-black tracking-tight text-zinc-900 lg:text-left lg:text-3xl">
                  Masuk ke Akun
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-500 lg:text-left">
                  Gunakan kredensial operasional Anda untuk melanjutkan.
                </p>
              </div>

              <form
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7"
                onSubmit={handleSubmit}
                noValidate
              >
                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">!</span>
                    <span className="flex-1 leading-5">{error}</span>
                    <button type="button" onClick={() => setError("")} className="text-red-800/60 hover:text-red-800">
                      ×
                    </button>
                  </div>
                )}

                <div className="grid gap-5">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Email</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-zinc-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m3 7 9 6 9-6" />
                        </svg>
                      </span>
                      <input
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@rsvhelmet.com"
                        autoComplete="email"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </label>

                  <label className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Kata sandi</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                        tabIndex={-1}
                      >
                        {showPassword ? "Sembunyi" : "Tampilkan"}
                      </button>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-zinc-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <rect x="3" y="11" width="18" height="10" rx="2" />
                          <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                        </svg>
                      </span>
                      <input
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </label>

                  <button
                    className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                          <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" className="opacity-75" />
                        </svg>
                        Memproses...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </button>

                  <p className="text-center text-xs leading-5 text-zinc-500">
                    Dengan masuk, Anda menyetujui kebijakan operasional RSV Helmet.
                  </p>
                </div>
              </form>

              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-center text-xs font-medium text-zinc-400">RSV Helmet — Sistem Inventaris Operasional • Secure • 24/7</p>
                <Link
                  to="/"
                  className="hidden items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 lg:inline-flex"
                >
                  ← Kembali ke Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
