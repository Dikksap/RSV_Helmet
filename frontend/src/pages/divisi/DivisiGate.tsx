import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";

export default function DivisiGate({ children }: { children: ReactNode }) {
  const { isAdmin, activeDivisiId, loading, error, reload, divisiList } =
    useDivisiWorkspace();

  if (loading) {
    return (
      <section className="rounded-xl bg-white p-6 text-center text-sm text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        Memuat divisi...
      </section>
    );
  }

  if (error && !activeDivisiId) {
    return (
      <section className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mb-2 h-5 w-5 text-[#EF4444]" />
        <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C48]"
        >
          Coba lagi
        </button>
      </section>
    );
  }

  if (!activeDivisiId) {
    return (
      <section className="rounded-xl border border-amber-200 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mb-2 h-5 w-5 text-amber-600" />
        <h2 className="text-base font-semibold text-[#1E3A5F]">
          {isAdmin ? "Belum ada divisi" : "Akun belum terhubung ke divisi"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[#6B7280]">
          {isAdmin
            ? "Tambahkan divisi terlebih dahulu di menu Kelola Divisi, lalu muat ulang halaman ini."
            : "Hubungi admin untuk mengatur divisi akun Anda di menu Kelola User."}
        </p>
        {isAdmin && divisiList.length === 0 && (
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50"
          >
            Muat ulang
          </button>
        )}
      </section>
    );
  }

  return <>{children}</>;
}
