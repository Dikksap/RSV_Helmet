import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setAuth, isAuthenticated } from "../api/auth";
import logoUrl from "../assets/logo.png";

const inputClass =
  "h-12 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[15px] font-medium text-[#1F2937] placeholder:text-[#6B7280] transition-colors duration-200 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/25 disabled:opacity-60";

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
    <div className="w-full bg-transparent">
      <div className="grid w-full lg:min-h-[calc(100svh-72px)] lg:grid-cols-2">
        {/* Left — brand panel (desktop) */}
        <div className="relative hidden overflow-hidden bg-[#0F1C2E] lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#0F1C2E] to-[#0F1C2E]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(0,168,232,0.20),transparent_50%)]" aria-hidden="true" />

          <div className="relative p-10">
            <Link to="/" className="inline-flex items-center gap-3 rounded-lg text-white focus-visible:outline-2 focus-visible:outline-[#00A8E8]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm">
                <img src={logoUrl} alt="RSV Helmet" className="h-7 w-7 object-contain" />
              </span>
              <span className="text-sm font-bold tracking-tight">RSV HELMET</span>
            </Link>
          </div>

          <div className="relative px-10 pb-10">
            <div className="max-w-md">
              <h1 className="text-4xl font-bold leading-[1.2] tracking-tight text-white">
                Sistem Inventaris
                <br />
                RSV Helmet
              </h1>
              <p className="mt-4 text-base leading-[1.6] text-slate-300">
                Kelola data barang, pencetakan hangtag, dan pemantauan stok dalam satu tempat.
              </p>

              <ul className="mt-8 space-y-3 text-[15px] text-slate-200">
                {[
                  "Pencatatan barang via scan QR",
                  "Cetak hangtag thermal presisi",
                  "Statistik stok real-time",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#00A8E8]/20 text-xs font-bold text-white">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative border-t border-white/10 px-10 py-6">
            <p className="text-[13px] text-slate-400">© {new Date().getFullYear()} RSV Helmet</p>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col">
          <div className="flex flex-1 items-center justify-center px-6 py-8 sm:py-12">
            <div className="w-full max-w-sm">
              <div className="mb-6 flex flex-col items-center text-center lg:hidden">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                  <img src={logoUrl} alt="RSV Helmet" className="h-8 w-8 object-contain" />
                </span>
                <p className="mt-3 text-sm font-bold tracking-tight text-[#1E3A5F]">RSV HELMET</p>
              </div>
              <div className="mb-6 text-center lg:mb-8 lg:text-left">
                <h1 className="text-[28px] font-semibold leading-[1.3] tracking-tight text-[#1E3A5F]">
                  Masuk
                </h1>
                <p className="mt-2 text-[15px] text-[#6B7280]">
                  Silakan masuk untuk melanjutkan.
                </p>
              </div>

              <form
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                onSubmit={handleSubmit}
                noValidate
              >
                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3 text-sm font-medium text-[#1F2937]" role="alert">
                    <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EF4444] text-xs font-bold text-white">!</span>
                    <span className="flex-1 leading-5">{error}</span>
                    <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error" className="rounded px-1 text-[#EF4444] transition-colors duration-200 hover:bg-[#EF4444]/10 focus-visible:outline-2 focus-visible:outline-[#EF4444]">
                      ×
                    </button>
                  </div>
                )}

                <div className="grid gap-5">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-[#1F2937]">Email</span>
                    <input
                      className={inputClass}
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
                      <span className="text-sm font-medium text-[#1F2937]">Kata Sandi</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="rounded text-[13px] font-medium text-[#0088C0] transition-colors duration-200 hover:text-[#00A8E8] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
                        tabIndex={-1}
                      >
                        {showPassword ? "Sembunyi" : "Tampilkan"}
                      </button>
                    </div>
                    <input
                      className={inputClass}
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
                    className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 text-[15px] font-medium text-white shadow-sm transition-colors duration-200 hover:bg-[#0088C0] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                  className="inline-block rounded-lg py-2 text-sm font-medium text-[#6B7280] transition-colors duration-200 hover:text-[#1E3A5F] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
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
