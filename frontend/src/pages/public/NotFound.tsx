import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-widest text-sky-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#172B45]"
        >
          Kembali ke beranda
        </Link>
      </section>
    </main>
  );
}
