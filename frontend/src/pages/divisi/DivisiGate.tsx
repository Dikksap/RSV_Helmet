import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "../../components/admin/HasilProduksiDivisi/ui";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";

const PANEL = "rounded-xl border border-[#D1D5DB] bg-white p-6 text-center shadow-sm";

export default function DivisiGate({ children }: { children: ReactNode }) {
  const { isAdmin, activeDivisiId, loading, error, reload, divisiList } =
    useDivisiWorkspace();

  if (loading) {
    return <section className={`${PANEL} text-sm text-[#6B7280]`}>Memuat divisi...</section>;
  }

  if (error && !activeDivisiId) {
    return (
      <section className={`${PANEL} border-[#EF4444]/30`}>
        <FontAwesomeIcon icon={faTriangleExclamation} className="mb-2 h-5 w-5 text-[#EF4444]" />
        <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>
        <button type="button" onClick={reload} className={`${btnPrimary} mt-3`}>
          Coba lagi
        </button>
      </section>
    );
  }

  if (!activeDivisiId) {
    return (
      <section className={`${PANEL} border-[#F59E0B]/40`}>
        <FontAwesomeIcon icon={faTriangleExclamation} className="mb-2 h-5 w-5 text-[#B45309]" />
        <h2 className="text-base font-semibold text-[#1E3A5F]">
          {isAdmin ? "Belum ada divisi" : "Akun belum terhubung ke divisi"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6B7280]">
          {isAdmin
            ? "Tambahkan divisi terlebih dahulu di menu Kelola Divisi, lalu muat ulang halaman ini."
            : "Hubungi admin untuk mengatur divisi akun Anda di menu Kelola User."}
        </p>
        {isAdmin && divisiList.length === 0 && (
          <button type="button" onClick={reload} className={`${btnPrimary} mt-3`}>
            Muat ulang
          </button>
        )}
      </section>
    );
  }

  return <>{children}</>;
}
