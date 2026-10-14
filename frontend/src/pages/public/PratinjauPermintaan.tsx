import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faDownload,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import type { PermintaanBarangRecord } from "../../api/permintaanBarang";
import { buildPermintaanPdf, sharePdfFile, whatsappText } from "../../lib/permintaanPdf";
import { PermintaanPaper } from "../../components/PermintaanBarang/PermintaanPaper";
import { Section } from "../../components/PermintaanBarang/Section";
import type { Notice, PermintaanDraft } from "../../components/PermintaanBarang/types";

const SCREEN_STYLE = `
  @media screen and (max-width: 940px) { .paper-zoom { zoom: .72; } }
  @media screen and (max-width: 760px) { .paper-zoom { zoom: .55; } }
  @media screen and (max-width: 600px) { .paper-zoom { zoom: .42; } }
  @media screen and (max-width: 460px) { .paper-zoom { zoom: .34; } }
`;

function recToDraft(rec: PermintaanBarangRecord): PermintaanDraft {
  return {
    tanggal: rec.tanggal,
    tanggalDibutuhkan: rec.tanggalDibutuhkan ?? "",
    departemen: rec.departemen,
    namaPeminta: rec.namaPeminta,
    kebutuhanUntuk: rec.kebutuhanUntuk,
    prioritas: rec.prioritas,
    alasan: rec.alasan,
    baris: rec.items.map((it) => ({
      itemId: it.itemId != null ? String(it.itemId) : "",
      kode: it.item?.kode ?? "",
      nama: it.nama,
      divisi: "",
      spesifikasi: it.spesifikasi ?? "",
      jumlah: String(it.jumlah),
      satuan: it.satuan ?? "",
    })),
  };
}

export default function PratinjauPermintaan() {
  const location = useLocation();
  const rec = (location.state as { rec?: PermintaanBarangRecord } | null)?.rec ?? null;

  const [busy, setBusy] = useState<"pdf" | "wa" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  function notify(tone: Notice["tone"], text: string) {
    setNotice({ tone, text });
    requestAnimationFrame(() =>
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  if (!rec) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-8 text-[#171717] sm:px-6">
        <div className="mx-auto max-w-[640px] rounded-lg border border-[#E5E5E5] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h1 className="text-lg font-extrabold uppercase tracking-wide">Pratinjau Kosong</h1>
          <p className="mt-2 text-[0.9rem] text-[#6b7280]">
            Data permintaan tidak ditemukan. Silakan isi form terlebih dahulu.
          </p>
          <Link
            to="/permintaan-barang"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B0B0B] px-6 py-3 text-[0.9rem] font-bold uppercase tracking-wider text-white transition hover:bg-[#E30613]"
          >
            Kembali ke Form
          </Link>
        </div>
      </div>
    );
  }

  const draft = recToDraft(rec);

  const onSimpanPdf = () => {
    if (busy) return;
    setBusy("pdf");
    try {
      const blob = buildPermintaanPdf(rec);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rec.noPermintaan}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      notify("success", `PDF ${rec.noPermintaan} terunduh.`);
    } finally {
      setBusy(null);
    }
  };

  const onBagikan = async () => {
    if (busy) return;
    setBusy("wa");
    try {
      const blob = buildPermintaanPdf(rec);
      const hasil = await sharePdfFile(blob, `${rec.noPermintaan}.pdf`, whatsappText(rec));
      notify(
        "success",
        hasil === "shared"
          ? `PDF ${rec.noPermintaan} siap dibagikan.`
          : `PDF ${rec.noPermintaan} terunduh. Lanjutkan kirim lewat WhatsApp yang terbuka.`,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        notify("success", "Berbagi dibatalkan.");
        return;
      }
      notify("error", error instanceof Error ? error.message : "Gagal membagikan PDF.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-8 text-[#171717] sm:px-6">
      <style>{SCREEN_STYLE}</style>
      <div className="mx-auto max-w-[1040px]">
        <header className="mb-6 overflow-hidden rounded-lg bg-[#0B0B0B] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <div className="text-[2rem] font-black leading-none tracking-tight">RSV HELMET</div>
              <div className="mt-2 text-[0.78rem] font-medium text-[#A3A3A3]">
                PT. RMI (RSV MANUFACTURE INDONESIA)
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[#A3A3A3]">
                No. Permintaan
              </div>
              <div className="mt-1 inline-block rounded border border-white/20 bg-white/5 px-3 py-1.5 font-mono text-[0.95rem] font-bold tracking-wide text-white">
                {rec.noPermintaan}
              </div>
            </div>
          </div>
          <div className="h-1 w-full bg-[#E30613]" />
        </header>

        {notice && (
          <div
            ref={noticeRef}
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-[0.88rem] font-medium ${
              notice.tone === "error"
                ? "border-[#E30613]/40 bg-[#FEF2F2] text-[#991B1B]"
                : "border-[#16A34A]/25 bg-[#F0FDF4] text-[#166534]"
            }`}
          >
            <FontAwesomeIcon
              icon={notice.tone === "error" ? faExclamationTriangle : faCheck}
              className={`mt-1 h-4 w-4 shrink-0 ${notice.tone === "error" ? "text-[#E30613]" : "text-[#16A34A]"}`}
            />
            <span className="flex-1 leading-relaxed">{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Tutup notifikasi"
              className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md transition hover:bg-black/5"
            >
              ✕
            </button>
          </div>
        )}

        <Section no="04" title="Pratinjau & Bagikan" subtitle="Preview & Share">
          <dl className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-[#E5E5E5] bg-[#F3F3F3] p-4 text-[0.82rem] sm:grid-cols-4">
            {[
              ["Departemen", rec.departemen || "-"],
              ["Peminta", rec.namaPeminta || "-"],
              ["Prioritas", rec.prioritas],
              ["Jumlah Item", `${rec.items.length} baris`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#A3A3A3]">{k}</dt>
                <dd className="truncate font-bold text-[#0B0B0B]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="-mx-5 overflow-x-auto border-y border-[#E5E5E5] bg-[#F3F3F3] p-4 sm:-mx-6 sm:p-6">
            <PermintaanPaper draft={draft} noPermintaan={rec.noPermintaan} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Link
              to="/permintaan-barang"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#DADADA] bg-white px-6 py-3.5 text-[0.9rem] font-bold uppercase tracking-wider text-[#171717] transition hover:border-[#0B0B0B]"
            >
              Buat Permintaan Baru
            </Link>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onSimpanPdf}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B0B0B] px-6 py-3.5 text-[0.9rem] font-bold uppercase tracking-wider text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faDownload} className="h-4 w-4" />
                {busy === "pdf" ? "Mengunduh..." : "Simpan PDF"}
              </button>
              <button
                type="button"
                onClick={onBagikan}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#E30613] px-8 py-3.5 text-[0.95rem] font-bold uppercase tracking-wider text-white shadow-[0_1px_3px_rgba(227,6,19,0.4)] transition hover:bg-[#B80510] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[280px]"
              >
                <FontAwesomeIcon icon={faWhatsapp} className="h-4 w-4" />
                {busy === "wa" ? "Membagikan..." : "Bagikan WhatsApp"}
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
