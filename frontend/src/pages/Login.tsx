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
    <div className="w-full bg-zinc-50">
      <div className="grid w-full lg:min-h-[calc(100svh-68px)] lg:grid-cols-2">
        {/* Left — brand panel (desktop) */}
        <div className="relative hidden overflow-hidden bg-zinc-900 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />

          <div className="relative p-10">
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm">
                <img src={logoUrl} alt="RSV Helmet" className="h-7 w-7 object-contain" />
              </span>
              <span className="text-sm font-black tracking-tight">RSV HELMET</span>
            </Link>
          </div>

          <div className="relative px-10 pb-10">
            <div className="max-w-md">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
                Sistem Inventaris
                <br />
                RSV Helmet
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Kelola data barang, pencetakan hangtag, dan pemantauan stok dalam satu tempat.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-white">✓</span>
                  Pencatatan barang via scan QR
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-white">✓</span>
                  Cetak hangtag thermal presisi
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-white">✓</span>
                  Statistik stok real-time
                </li>
              </ul>
            </div>
          </div>

          <div className="relative border-t border-white/10 px-10 py-6">
            <p className="text-xs text-zinc-500">© {new Date().getFullYear()} RSV Helmet</p>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col">
          <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-10 sm:py-10">
            <div className="w-full max-w-sm">
              <div className="mb-6 flex flex-col items-center text-center lg:hidden">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <img src={logoUrl} alt="RSV Helmet" className="h-8 w-8 object-contain" />
                </span>
                <p className="mt-3 text-sm font-black tracking-tight text-zinc-900">RSV HELMET</p>
              </div>
              <div className="mb-6 text-center lg:mb-8 lg:text-left">
                <h1 className="text-2xl font-black tracking-tight text-zinc-900">
                  Masuk
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Silakan masuk untuk melanjutkan.
                </p>
              </div>

              <form
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
                onSubmit={handleSubmit}
                noValidate
              >
                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">!</span>
                    <span className="flex-1 leading-5">{error}</span>
                    <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error" className="text-red-800/60 hover:text-red-800">
                      ×
                    </button>
                  </div>
                )}

                <div className="grid gap-5">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Email</span>
                    <input
                      className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60 sm:text-sm"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@perusahaan.com"
                      autoComplete="email"
                      required
                      disabled={isLoading}
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Kata Sandi</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                        tabIndex={-1}
                      >
                        {showPassword ? "Sembunyi" : "Tampilkan"}
                      </button>
                    </div>
                    <input
                      className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60 sm:text-sm"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      autoComplete="current-password"
                      required
                      disabled={isLoading}
                    />
                  </label>

                  <button
                    className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
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
                </div>
              </form>

              <div className="mt-6 pb-2 text-center">
                <Link
                  to="/"
                  className="inline-block py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
                >
                  ← Kembali ke beranda
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
