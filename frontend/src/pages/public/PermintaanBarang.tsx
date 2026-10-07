import { useRef, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faCalendarDays,
  faCheck,
  faClipboardList,
  faExclamationTriangle,
  faPlus,
  faTrash,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { createPermintaan } from "../../api/permintaanBarang";
import { buildPermintaanPdf, sharePdfFile, whatsappText } from "../../lib/permintaanPdf";

type Baris = {
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
};

type Notice = { tone: "error" | "success"; text: string };

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const formatTanggalID = (iso: string): string => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${BULAN_ID[m - 1]} ${y}`;
};

/* ---------- Design tokens (kelas input) ---------- */
const inputBase =
  "w-full rounded-lg border border-[#DADADA] bg-white px-3.5 py-2.5 text-[0.95rem] text-[#171717] " +
  "placeholder:text-[#A3A3A3] transition focus:outline-none focus:ring-4 " +
  "focus:ring-[#E30613]/10 focus:border-[#E30613] disabled:bg-[#F3F3F3]";
const inputCls = inputBase;
const labelCls = "mb-1.5 block text-[0.82rem] font-semibold uppercase tracking-wide text-[#171717]";
const req = <span className="text-[#E30613]">*</span>;

/* ---------- Style layar ---------- */
const SCREEN_STYLE = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  input[type="date"] { color-scheme: light; }
  /* Pratinjau A4 diperkecil otomatis di layar kecil (tidak berpengaruh saat cetak) */
  @media screen and (max-width: 940px) { .paper-zoom { zoom: .72; } }
  @media screen and (max-width: 760px) { .paper-zoom { zoom: .55; } }
  @media screen and (max-width: 600px) { .paper-zoom { zoom: .42; } }
  @media screen and (max-width: 460px) { .paper-zoom { zoom: .34; } }
`;

function Section({
  no,
  title,
  subtitle,
  children,
}: {
  no: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="mb-5 flex items-start gap-4 border-b border-[#E5E5E5] pb-4">
        <span className="text-[2rem] font-black leading-none tracking-tight text-[#E30613]">
          {no}
        </span>
        <span className="border-l-2 border-[#E30613] pl-4">
          <h2 className="text-[1.05rem] font-extrabold uppercase tracking-wide text-[#0B0B0B]">
            {title}
          </h2>
          <p className="mt-0.5 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-[#A3A3A3]">
            {subtitle}
          </p>
        </span>
      </div>
      {children}
    </section>
  );
}

function PermintaanBarang() {
  const [noPermintaan, setNoPermintaan] = useState("");
  const [saving, setSaving] = useState(false);
  const [tanggal, setTanggal] = useState(todayISO);
  const [departemen, setDepartemen] = useState("");
  const [namaPeminta, setNamaPeminta] = useState("");
  const [kebutuhanUntuk, setKebutuhanUntuk] = useState("Produksi");
  const [prioritas, setPrioritas] = useState("Normal");
  const [tanggalDibutuhkan, setTanggalDibutuhkan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [baris, setBaris] = useState<Baris[]>([
    { nama: "", spesifikasi: "", jumlah: "", satuan: "" },
  ]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const noticeRef = useRef<HTMLDivElement>(null);

  /* ---------- Notifikasi inline (pengganti window.alert) ---------- */
  function notify(tone: Notice["tone"], text: string) {
    setNotice({ tone, text });
    requestAnimationFrame(() =>
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  const updateBaris = (index: number, field: keyof Baris, value: string) =>
    setBaris((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const tambahBarang = () =>
    setBaris((prev) => [...prev, { nama: "", spesifikasi: "", jumlah: "", satuan: "" }]);

  const hapusBarang = (index: number) => {
    if (baris.length <= 1) {
      notify("error", "Minimal harus ada 1 barang dalam permintaan.");
      return;
    }
    setBaris((prev) => prev.filter((_, i) => i !== index));
  };

  const cekBaris = (): boolean => {
    if (baris.length === 0) {
      notify("error", "Anda belum menambahkan data barang.");
      return false;
    }
    for (let i = 0; i < baris.length; i++) {
      const b = baris[i];
      if (!b.nama.trim()) {
        notify("error", `Nama barang pada baris ${i + 1} wajib diisi.`);
        return false;
      }
      if (!b.jumlah || Number(b.jumlah) <= 0) {
        notify("error", `Jumlah barang pada baris ${i + 1} harus lebih dari 0.`);
        return false;
      }
    }
    return true;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!cekBaris()) return;
    setSaving(true);
    setNotice(null);
    let nomor = "";
    try {
      const rec = await createPermintaan({
        tanggal,
        departemen: departemen.trim(),
        namaPeminta: namaPeminta.trim(),
        kebutuhanUntuk,
        prioritas,
        tanggalDibutuhkan: tanggalDibutuhkan || null,
        alasan: alasan.trim(),
        items: baris.map((b) => ({
          nama: b.nama.trim(),
          spesifikasi: b.spesifikasi.trim() || null,
          jumlah: Number(b.jumlah),
          satuan: b.satuan.trim() || null,
        })),
      });
      setNoPermintaan(rec.noPermintaan);
      nomor = rec.noPermintaan;
      notify("success", `Permintaan ${nomor} tersimpan. Membuat PDF...`);
      const blob = buildPermintaanPdf(rec);
      const hasil = await sharePdfFile(blob, `${nomor}.pdf`, whatsappText(rec));
      notify(
        "success",
        hasil === "shared"
          ? `PDF ${nomor} siap dibagikan.`
          : `PDF ${nomor} terunduh. Lanjutkan kirim lewat WhatsApp yang terbuka.`,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        notify("success", nomor ? `Permintaan ${nomor} tersimpan. Berbagi dibatalkan.` : "Berbagi dibatalkan.");
        return;
      }
      notify(
        "error",
        error instanceof Error ? error.message : "Gagal menyimpan permintaan.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-8 text-[#171717] sm:px-6">
      <style>{SCREEN_STYLE}</style>

      <div className="mx-auto max-w-[1040px]">
        {/* ---------- Header ---------- */}
        <header className="mb-6 overflow-hidden rounded-lg bg-[#0B0B0B] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <div className="text-[2rem] font-black leading-none tracking-tight">
                RSV HELMET
              </div>
              <div className="mt-2 text-[0.78rem] font-medium text-[#A3A3A3]">
                PT. RMI (RSV MANUFACTURE INDONESIA)
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[#A3A3A3]">
                No. Permintaan
              </div>
              <div className="mt-1 inline-block rounded border border-white/20 bg-white/5 px-3 py-1.5 font-mono text-[0.95rem] font-bold tracking-wide text-white">
                {noPermintaan || "PR- tertunda "}
              </div>
            </div>
          </div>
          <div className="h-1 w-full bg-[#E30613]" />
        </header>

        {/* ---------- Notifikasi ---------- */}
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
              className={`mt-1 h-4 w-4 shrink-0 ${
                notice.tone === "error" ? "text-[#E30613]" : "text-[#16A34A]"
              }`}
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

        {/* ---------- Form ---------- */}
        <form onSubmit={onSubmit}>
          <Section no="01" title="Informasi Permintaan" subtitle="Request Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="f-tanggal" className={labelCls}>
                  <FontAwesomeIcon icon={faCalendarDays} className="mr-1.5 h-3.5 w-3.5 text-[#A3A3A3]" />
                  Tanggal Permintaan {req}
                </label>
                <input
                  id="f-tanggal"
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="f-dibutuhkan" className={labelCls}>
                  <FontAwesomeIcon icon={faCalendarDays} className="mr-1.5 h-3.5 w-3.5 text-[#A3A3A3]" />
                  Tanggal Dibutuhkan
                </label>
                <input
                  id="f-dibutuhkan"
                  type="date"
                  value={tanggalDibutuhkan}
                  onChange={(e) => setTanggalDibutuhkan(e.target.value)}
                  className={inputCls}
                />
              </div>
               <div>
                <label htmlFor="f-peminta" className={labelCls}>
                  <FontAwesomeIcon icon={faUser} className="mr-1.5 h-3.5 w-3.5 text-[#A3A3A3]" />
                  Nama {req}
                </label>
                <input
                  id="f-peminta"
                  required
                  value={namaPeminta}
                  onChange={(e) => setNamaPeminta(e.target.value)}
                  placeholder="Nama lengkap"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="f-departemen" className={labelCls}>
                  <FontAwesomeIcon icon={faBuilding} className="mr-1.5 h-3.5 w-3.5 text-[#A3A3A3]" />
                  DIVISI {req}
                </label>
                <input
                  id="f-departemen"
                  required
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  placeholder="Contoh: Produksi"
                  className={inputCls}
                />
              </div>
             
              <div>
                <label htmlFor="f-kebutuhan" className={labelCls}>
                  <FontAwesomeIcon icon={faClipboardList} className="mr-1.5 h-3.5 w-3.5 text-[#A3A3A3]" />
                  Kebutuhan Untuk
                </label>
                <select
                  id="f-kebutuhan"
                  value={kebutuhanUntuk}
                  onChange={(e) => setKebutuhanUntuk(e.target.value)}
                  className={inputCls}
                >
                  <option>Produksi</option>
                  <option>Maintenance</option>
                  <option>Proyek</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-prioritas" className={labelCls}>
                  Prioritas
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                      prioritas === "Urgent" ? "bg-[#E30613]" : "bg-[#A3A3A3]"
                    }`}
                  />
                  <select
                    id="f-prioritas"
                    value={prioritas}
                    onChange={(e) => setPrioritas(e.target.value)}
                    className={`${inputCls} pl-9 font-bold uppercase tracking-wide ${
                      prioritas === "Urgent" ? "text-[#E30613]" : "text-[#171717]"
                    }`}
                  >
                    <option>Normal</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section no="02" title="Detail Barang" subtitle="Item Details">
            {/* Desktop: tabel editor */}
            <div className="hidden overflow-x-auto rounded-lg border border-[#E5E5E5] md:block">
              <table className="w-full border-collapse bg-white text-left text-[0.9rem]">
                <thead>
                  <tr className="bg-[#0B0B0B] text-white">
                    <th className="w-12 border-b-2 border-[#E30613] px-4 py-3 text-center text-xs font-bold">#</th>
                    <th className="border-b-2 border-[#E30613] px-4 py-3 text-xs font-bold uppercase tracking-wider">Nama Barang</th>
                    <th className="border-b-2 border-[#E30613] px-4 py-3 text-xs font-bold uppercase tracking-wider">Spesifikasi</th>
                    <th className="w-24 border-b-2 border-[#E30613] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Qty</th>
                    <th className="w-28 border-b-2 border-[#E30613] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Satuan</th>
                    <th className="w-14 border-b-2 border-[#E30613] px-4 py-3" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {baris.map((b, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-2.5 text-center text-[1rem] font-black text-[#E30613]">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          id={`b-nama-${i}`}
                          aria-label={`Nama barang baris ${i + 1}`}
                          value={b.nama}
                          onChange={(e) => updateBaris(i, "nama", e.target.value)}
                          placeholder="Contoh: Kertas A4"
                          className={`${inputCls} border-0 px-2 py-2 focus:ring-2`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          id={`b-spek-${i}`}
                          aria-label={`Spesifikasi baris ${i + 1}`}
                          value={b.spesifikasi}
                          onChange={(e) => updateBaris(i, "spesifikasi", e.target.value)}
                          placeholder="Merek / ukuran"
                          className={`${inputCls} border-0 px-2 py-2 focus:ring-2`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          id={`b-jml-${i}`}
                          aria-label={`Jumlah baris ${i + 1}`}
                          type="number"
                          min="1"
                          value={b.jumlah}
                          onChange={(e) => updateBaris(i, "jumlah", e.target.value)}
                          placeholder="0"
                          className={`${inputCls} border-0 px-2 py-2 text-center font-bold focus:ring-2`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          id={`b-sat-${i}`}
                          aria-label={`Satuan baris ${i + 1}`}
                          value={b.satuan}
                          onChange={(e) => updateBaris(i, "satuan", e.target.value)}
                          placeholder="Pcs"
                          className={`${inputCls} border-0 px-2 py-2 text-center focus:ring-2`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => hapusBarang(i)}
                          disabled={baris.length <= 1}
                          title={baris.length <= 1 ? "Minimal 1 barang" : "Hapus barang"}
                          aria-label={`Hapus barang baris ${i + 1}`}
                          className="rounded p-1.5 text-[#A3A3A3] transition hover:bg-[#E30613]/10 hover:text-[#E30613] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: kartu */}
            <div className="flex flex-col gap-3 md:hidden">
              {baris.map((b, i) => (
                <div key={i} className="rounded-lg border border-[#E5E5E5] bg-[#F3F3F3]/50 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[1rem] font-black text-[#E30613]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => hapusBarang(i)}
                      disabled={baris.length <= 1}
                      aria-label={`Hapus barang baris ${i + 1}`}
                      className="rounded p-1.5 text-[#A3A3A3] transition hover:bg-[#E30613]/10 hover:text-[#E30613] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label htmlFor={`b-nama-${i}`} className={labelCls}>
                        Nama Barang / Bahan {req}
                      </label>
                      <input
                        id={`b-nama-${i}`}
                        value={b.nama}
                        onChange={(e) => updateBaris(i, "nama", e.target.value)}
                        placeholder="Contoh: Kertas A4"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor={`b-spek-${i}`} className={labelCls}>
                        Spesifikasi
                      </label>
                      <input
                        id={`b-spek-${i}`}
                        value={b.spesifikasi}
                        onChange={(e) => updateBaris(i, "spesifikasi", e.target.value)}
                        placeholder="Merek / ukuran"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`b-jml-${i}`} className={labelCls}>
                          Jumlah {req}
                        </label>
                        <input
                          id={`b-jml-${i}`}
                          type="number"
                          min="1"
                          value={b.jumlah}
                          onChange={(e) => updateBaris(i, "jumlah", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor={`b-sat-${i}`} className={labelCls}>
                          Satuan
                        </label>
                        <input
                          id={`b-sat-${i}`}
                          value={b.satuan}
                          onChange={(e) => updateBaris(i, "satuan", e.target.value)}
                          placeholder="Pcs"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={tambahBarang}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#A3A3A3] bg-white px-5 py-3 text-[0.85rem] font-bold uppercase tracking-wider text-[#171717] transition hover:border-[#E30613] hover:text-[#E30613]"
            >
              <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
              Tambah Barang
            </button>
          </Section>

          <Section no="03" title="Alasan Permintaan" subtitle="Request Reason">
            <label htmlFor="f-alasan" className={labelCls}>
              Jelaskan Alasan {req}
            </label>
            <textarea
              id="f-alasan"
              rows={4}
              required
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: Stok bahan baku untuk produksi bulan ini sudah habis."
              className={`${inputCls} resize-y`}
            />
            <p className="mt-2 text-[0.78rem] text-[#A3A3A3]">
              Tuliskan alasan sejelas mungkin agar permintaan mudah disetujui.
            </p>
          </Section>

          <Section no="04" title="Pratinjau & Bagikan" subtitle="Preview & Share">

            {/* Ringkasan singkat */}
            <dl className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-[#E5E5E5] bg-[#F3F3F3] p-4 text-[0.82rem] sm:grid-cols-4">
              {[
                ["Departemen", departemen || "-"],
                ["Peminta", namaPeminta || "-"],
                ["Prioritas", prioritas],
                ["Jumlah Item", `${baris.length} baris`],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#A3A3A3]">
                    {k}
                  </dt>
                  <dd className="truncate font-bold text-[#0B0B0B]">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="-mx-5 overflow-x-auto border-y border-[#E5E5E5] bg-[#F3F3F3] p-4 sm:-mx-6 sm:p-6">
              <div
                id="permintaan-paper"
                className="paper-zoom mx-auto flex w-[210mm] flex-col bg-white px-[16mm] py-[14mm] font-[Arial,Helvetica,sans-serif] text-[9.5pt] leading-normal text-[#1f2937] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
              >
                <div className="mb-[4mm] flex items-end justify-between">
                  <div>
                    <div className="text-[26pt] font-black leading-none tracking-tight text-[#0B0B0B]">
                      RSV
                    </div>
                    <div className="mt-[1mm] text-[9pt] font-bold uppercase tracking-[0.3em] text-[#0B0B0B]">
                      Helmet Indonesia
                    </div>
                    <div className="mt-[1mm] text-[8pt] text-[#6b7280]">
                      PT. RSV MANUFACTURE INDONESIA — Inventory &amp; Procurement System
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11pt] font-bold uppercase tracking-wide text-[#0B0B0B]">
                      Form Permintaan Barang
                    </div>
                    <div className="mt-[1mm] font-mono text-[10pt] font-bold text-[#E30613]">
                      {noPermintaan || "PR-........"}
                    </div>
                  </div>
                </div>
                <div className="mb-[6mm] h-[2.5mm] w-full bg-[#E30613]" />

                <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
                  Document Information
                </div>
                <div className="mb-[6mm] rounded border border-[#d7e0ee] bg-[#f8fafc] px-[4mm] py-[3mm]">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-[24%] py-[0.5mm] text-[#6b7280]">No. Permintaan</td>
                        <td className="w-[26%] font-bold">{noPermintaan || "-"}</td>
                        <td className="w-[24%] text-[#6b7280]">Tanggal Form</td>
                        <td className="font-bold">{formatTanggalID(tanggal)}</td>
                      </tr>
                      <tr>
                        <td className="py-[0.5mm] text-[#6b7280]">Departemen</td>
                        <td className="font-bold">{departemen || "-"}</td>
                        <td className="text-[#6b7280]">Tgl. Dibutuhkan</td>
                        <td className="font-bold">{formatTanggalID(tanggalDibutuhkan)}</td>
                      </tr>
                      <tr>
                        <td className="py-[0.5mm] text-[#6b7280]">Peminta</td>
                        <td className="font-bold">{namaPeminta || "-"}</td>
                        <td className="text-[#6b7280]">Prioritas</td>
                        <td className="font-bold">{prioritas}</td>
                      </tr>
                      <tr>
                        <td className="py-[0.5mm] text-[#6b7280]">Kebutuhan Untuk</td>
                        <td className="font-bold" colSpan={3}>
                          {kebutuhanUntuk}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
                  Item Details
                </div>
                <table className="mb-[6mm] w-full border-collapse text-[9pt]">
                  <thead>
                    <tr className="bg-[#0B0B0B] text-white">
                      <th className="w-[6%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
                        No
                      </th>
                      <th className="border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-left">
                        Nama Barang / Bahan
                      </th>
                      <th className="border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-left">
                        Spesifikasi
                      </th>
                      <th className="w-[10%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
                        Jml
                      </th>
                      <th className="w-[14%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
                        Satuan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((b, i) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}>
                        <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center font-bold text-[#E30613]">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">
                          {b.nama || "-"}
                        </td>
                        <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">
                          {b.spesifikasi || "-"}
                        </td>
                        <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">
                          {b.jumlah || "-"}
                        </td>
                        <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">
                          {b.satuan || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
                  Request Reason
                </div>
                <div className="mb-[10mm] min-h-[14mm] whitespace-pre-line rounded border border-[#d7e0ee] px-[4mm] py-[3mm]">
                  {alasan || "-"}
                </div>

                <div className="grid grid-cols-3 text-center text-[9pt]">
                  {[
                    { label: "Dibuat Oleh\n(PIC)", name: namaPeminta.toUpperCase() },
                    { label: "Diperiksa Oleh\n(Kepala Produksi)", name: "" },
                    { label: "Disetujui Oleh\n(Inventori Kontrol)", name: "" },
                  ].map((s) => (
                    <div key={s.label} className="sig-col px-[2mm]">
                      <div className="mb-[16mm] whitespace-pre-line text-[#374151]">
                        {s.label}
                      </div>
                      <div
                        className={`border-t border-[#1f2937] pt-[1.5mm] ${
                          s.name ? "font-bold" : ""
                        }`}
                      >
                        {s.name || "(............................)"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#E30613] px-8 py-3.5 text-[0.95rem] font-bold uppercase tracking-wider text-white shadow-[0_1px_3px_rgba(227,6,19,0.4)] transition hover:bg-[#B80510] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[280px]"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faWhatsapp} className="h-4 w-4" />
                    Simpan &amp; Bagikan WhatsApp
                  </>
                )}
              </button>
            </div>
          </Section>
        </form>
      </div>
    </div>
  );
}

export default PermintaanBarang;
