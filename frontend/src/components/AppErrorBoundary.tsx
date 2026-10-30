import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Kesalahan saat merender aplikasi:", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
          <section role="alert" className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Terjadi Kesalahan</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Halaman tidak dapat ditampilkan</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Aplikasi mengalami kendala saat memuat halaman. Muat ulang halaman atau kembali ke beranda.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#172B45]"
              >
                Muat ulang
              </button>
              <a
                href={window.location.protocol === "file:" ? "#/" : "/"}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali ke beranda
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
