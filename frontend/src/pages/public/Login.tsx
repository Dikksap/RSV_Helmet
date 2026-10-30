
import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  checkSession,
  getUser,
  homeForRole,
  isAuthenticated,
  login,
  setAuth,
} from "../../api/auth";
import { getApiErrorMessage } from "../../api/errors";
import logoUrl from "../../assets/logo.png";

const inputClass =
  "h-[50px] w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(homeForRole(getUser()?.role), { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await login({ email, password });

      setAuth(response.token, response.user);
      await checkSession();

      navigate(homeForRole(response.user.role), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Terjadi kesalahan saat masuk. Silakan coba kembali."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-svh bg-[#F4F7FB] p-0 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-svh w-full max-w-[1440px] overflow-hidden bg-white shadow-sm sm:min-h-[calc(100svh-40px)] sm:rounded-3xl sm:border sm:border-slate-200/80 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Panel branding */}
        <section className="relative hidden overflow-hidden bg-[#101E33] lg:flex lg:flex-col">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(0,168,232,0.24),transparent_45%),radial-gradient(ellipse_at_90%_90%,rgba(30,58,95,0.85),transparent_50%)]"
          />

          <div
            aria-hidden="true"
            className="absolute -right-32 top-1/4 h-[430px] w-[430px] rounded-full border border-white/[0.07]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-20 top-[29%] h-[310px] w-[310px] rounded-full border border-white/[0.08]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-8 top-[35%] h-[180px] w-[180px] rounded-full border border-sky-400/10"
          />

          <div className="relative flex items-center justify-between px-10 py-9 xl:px-14">
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-lg shadow-black/10">
                <img
                  src={logoUrl}
                  alt="RSV Helmet"
                  className="h-8 w-8 object-contain"
                />
              </span>

              <span>
                <span className="block text-sm font-extrabold tracking-[0.15em] text-white">
                  RSV HELMET
                </span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                  Manufacturing System
                </span>
              </span>
            </Link>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Internal System
            </span>
          </div>

          <div className="relative flex flex-1 flex-col justify-center px-10 py-12 xl:px-14">
            <div className="max-w-lg">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-3.5 py-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <span className="text-xs font-medium tracking-wide text-sky-200">
                  Sistem Manajemen Produksi
                </span>
              </div>

              <h1 className="text-4xl font-bold leading-[1.2] tracking-tight text-white xl:text-[48px]">
                Kelola produksi.
                <br />
                <span className="text-sky-400">Lebih terintegrasi.</span>
              </h1>

              <p className="mt-6 max-w-md text-[15px] leading-7 text-slate-300">
                Satu platform untuk membantu pengelolaan inventaris,
                pencatatan barang, pencetakan hangtag, dan pemantauan stok
                RSV Helmet.
              </p>

              <div className="mt-10 grid max-w-md grid-cols-1 gap-3">
                {[
                  {
                    number: "01",
                    title: "Manajemen inventaris",
                    description: "Kelola data barang dan persediaan.",
                  },
                  {
                    number: "02",
                    title: "Pencatatan lebih praktis",
                    description: "Dukung proses pencatatan dan pemindaian.",
                  },
                  {
                    number: "03",
                    title: "Monitoring stok",
                    description: "Pantau informasi stok dalam satu sistem.",
                  },
                ].map((feature) => (
                  <div
                    key={feature.number}
                    className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition-colors hover:border-sky-400/20 hover:bg-white/[0.06]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-400/15 bg-sky-400/[0.08] text-xs font-bold text-sky-300">
                      {feature.number}
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/[0.08] px-10 py-6 xl:px-14">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} RSV Helmet
            </p>
            <p className="text-xs text-slate-500">
              Sistem internal perusahaan
            </p>
          </div>
        </section>

        {/* Area login */}
        <section className="flex min-h-svh flex-col bg-white sm:min-h-0">
          <header className="flex items-center justify-between px-6 py-5 sm:px-10 sm:py-7 lg:justify-end lg:px-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:hidden"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white">
                <img
                  src={logoUrl}
                  alt="RSV Helmet"
                  className="h-7 w-7 object-contain"
                />
              </span>
              <span className="text-xs font-extrabold tracking-wider text-[#1E3A5F]">
                RSV HELMET
              </span>
            </Link>

            <Link
              to="/"
              className="hidden items-center gap-2 rounded-lg text-xs font-medium text-slate-500 transition-colors hover:text-sky-600 focus-visible:outline-2 focus-visible:outline-sky-500 lg:inline-flex"
            >
              Kembali ke beranda
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
              >
                <path
                  d="M4.5 10h11m-4.5-4.5 4.5 4.5-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-5 sm:px-10 sm:pb-12 lg:px-12">
            <div className="w-full max-w-[390px]">
              <div className="mb-8">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                  Selamat datang kembali
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-[#172B45] sm:text-[34px]">
                  Masuk ke akun
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Masukkan kredensial Anda untuk melanjutkan ke sistem RSV
                  Helmet.
                </p>
              </div>

              {sessionExpired && !error && (
                <div
                  role="status"
                  className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  >
                    <path
                      d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.74 3h14.92a2 2 0 0 0 1.74-3l-7.46-13.1a2 2 0 0 0-3.48 0Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-sm leading-5 text-amber-800">
                    Sesi Anda telah berakhir. Silakan masuk kembali.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="7.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M10 6.5v4m0 2.5h.01"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>

                  <p className="flex-1 text-sm leading-5 text-red-700">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={() => setError("")}
                    aria-label="Tutup pesan error"
                    className="rounded-md px-1 text-lg leading-none text-red-500 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500"
                  >
                    ×
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Email
                    </span>

                    <div className="relative">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="m4 7 8 6 8-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <input
                        className={`${inputClass} pl-11`}
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        autoComplete="email"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Kata sandi
                    </span>

                    <div className="relative">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                      >
                        <rect
                          x="4"
                          y="10"
                          width="16"
                          height="11"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M8 10V7a4 4 0 1 1 8 0v3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>

                      <input
                        className={`${inputClass} pl-11 pr-24`}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi"
                        autoComplete="current-password"
                        required
                        disabled={isLoading}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword
                            ? "Sembunyikan kata sandi"
                            : "Tampilkan kata sandi"
                        }
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-500"
                      >
                        {showPassword ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#079DD5] px-5 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(7,157,213,0.20)] transition-all hover:bg-[#0789BA] hover:shadow-[0_7px_20px_rgba(7,157,213,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="opacity-25"
                          />
                          <path
                            d="M21 12a9 9 0 0 0-9-9"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="opacity-90"
                          />
                        </svg>
                        Memverifikasi akun...
                      </>
                    ) : (
                      <>
                        Masuk ke sistem
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <path
                            d="M3.5 10h13m-5-5 5 5-5 5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  RSV Helmet
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                Gunakan akun yang telah terdaftar untuk mengakses sistem
                internal perusahaan.
              </p>

              <div className="mt-6 text-center lg:hidden">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="m12.5 4.5-5.5 5.5 5.5 5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Kembali ke beranda
                </Link>
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-100 px-6 py-4 text-center sm:px-10 lg:border-t-0 lg:px-12 lg:pb-7">
            <p className="text-[11px] text-slate-400">
              © {new Date().getFullYear()} RSV Helmet. Hak cipta dilindungi.
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default Login;
