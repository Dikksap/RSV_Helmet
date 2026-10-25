import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faCalendarDays,
  faCheck,
  faClipboardList,
  faExclamationTriangle,
  faPlus,
  faUser,
  faBoxOpen,
  faLayerGroup,
  faTimes,
  faArrowLeft,
  faFilePen,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { createPermintaan } from "../../api/permintaanBarang";
import { getItems, type Item } from "../../api/item";
import { buildPermintaanPdf, sharePdfFile, whatsappText } from "../../lib/permintaanPdf";
import { inputCls, labelCls, req } from "../../components/PermintaanBarang/formUi";
import { Section } from "../../components/PermintaanBarang/Section";
import { BarisBarangCard } from "../../components/PermintaanBarang/BarisBarangCard";
import { BARIS_KOSONG, type Baris, type Notice } from "../../components/PermintaanBarang/types";

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

function PermintaanBarang() {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [tanggal, setTanggal] = useState(todayISO());
  const [departemen, setDepartemen] = useState("");
  const [namaPeminta, setNamaPeminta] = useState("");
  const [kebutuhanUntuk, setKebutuhanUntuk] = useState("Produksi");
  const [prioritas, setPrioritas] = useState("Normal");
  const [tanggalDibutuhkan, setTanggalDibutuhkan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [baris, setBaris] = useState<Baris[]>([{ ...BARIS_KOSONG }]);
  const [masterItem, setMasterItem] = useState<Item[]>([]);
  const [masterState, setMasterState] = useState<"loading" | "ready" | "error">("loading");
  const [divisiList, setDivisiList] = useState<{ id: number; nama: string }[]>([]);
  const [divisiManual, setDivisiManual] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const noticeRef = useRef<HTMLDivElement>(null);

  const muatMaster = () => {
    setMasterState("loading");
    getItems({ aktif: true })
      .then((rows) => {
        setMasterItem(rows.filter((item) => item.jenis !== "SM"));
        setMasterState("ready");
      })
      .catch(() => {
        setMasterItem([]);
        setMasterState("error");
      });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat master saat mount
    muatMaster();
    fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api"}/divisi`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (Array.isArray(rows)) {
          setDivisiList(
            rows
              .filter((d): d is { id: number; nama: string } =>
                typeof d === "object" && d !== null &&
                typeof (d as { id?: unknown }).id === "number" &&
                typeof (d as { nama?: unknown }).nama === "string",
              )
              .sort((a, b) => a.nama.localeCompare(b.nama)),
          );
        }
      })
      .catch(() => setDivisiList([]));
  }, []);

  const pilihItem = (index: number, id: string) =>
    setBaris((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        if (!id) return { ...b, itemId: "", kode: "", divisi: "" };
        const m = masterItem.find((x) => String(x.id) === id);
        if (!m) return { ...b, itemId: "", kode: "", divisi: "" };
        return { ...b, itemId: id, kode: m.kode, nama: m.nama, satuan: m.unit, divisi: m.divisi?.nama ?? "" };
      }),
    );

  function notify(tone: Notice["tone"], text: string) {
    setNotice({ tone, text });
    requestAnimationFrame(() =>
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  const updateBaris = (index: number, field: keyof Baris, value: string) =>
    setBaris((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const namaBebas = (index: number, text: string) =>
    setBaris((prev) =>
      prev.map((b, i) => (i === index ? { ...b, itemId: "", nama: text } : b)),
    );

  const rowError = (b: Baris, i: number): string | null => {
    if (!b.nama.trim()) return `Nama barang pada baris ${i + 1} wajib diisi.`;
    const n = Number(b.jumlah);
    if (!b.jumlah || !Number.isInteger(n) || n <= 0) {
      return `Jumlah barang pada baris ${i + 1} harus bilangan bulat lebih dari 0.`;
    }
    return null;
  };

  const tambahBarang = () =>
    setBaris((prev) => [...prev, { ...BARIS_KOSONG }]);

  const hapusBarang = (index: number) => {
    if (baris.length <= 1) {
      notify("error", "Minimal harus ada 1 barang dalam permintaan.");
      return;
    }
    setBaris((prev) => prev.filter((_, i) => i !== index));
  };

  const cekBaris = (): boolean => {
    setTriedSubmit(true);
    if (baris.length === 0) {
      notify("error", "Anda belum menambahkan data barang.");
      return false;
    }
    for (let i = 0; i < baris.length; i++) {
      const err = rowError(baris[i], i);
      if (err) {
        notify("error", err);
        return false;
      }
    }
    return true;
  };

  const ringkasan = baris.reduce(
    (acc, b) => {
      const n = Number(b.jumlah);
      if (b.nama.trim() && Number.isInteger(n) && n > 0) {
        acc.jenis += 1;
        acc.qty += n;
      }
      return acc;
    },
    { jenis: 0, qty: 0 },
  );

  const stepJumlah = (index: number, delta: 1 | -1) => {
    const cur = Number(baris[index]?.jumlah);
    const next = delta === 1 ? (Number.isFinite(cur) ? Math.floor(cur) + 1 : 1) : Math.max(1, (Number.isFinite(cur) ? Math.ceil(cur) : 2) - 1);
    updateBaris(index, "jumlah", String(next));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!cekBaris()) return;
    setSaving(true);
    setNotice(null);
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
          itemId: b.itemId ? Number(b.itemId) : null,
          nama: b.nama.trim(),
          spesifikasi: b.spesifikasi.trim() || null,
          jumlah: Number(b.jumlah),
          satuan: b.satuan.trim() || null,
        })),
      });
      const blob = buildPermintaanPdf(rec);
      try {
        await sharePdfFile(blob, `${rec.noPermintaan}.pdf`, whatsappText(rec));
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) throw error;
      }
      navigate("/permintaan-barang/pratinjau", { state: { rec } });
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Gagal menyimpan permintaan.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-0">
        
        {/* Header RSV Helmet */}
        <header className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg shadow-slate-200">
          <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight sm:text-3xl">
                  RSV<span className="text-[#E30613]">HELMET</span>
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-300">
                  Internal System
                </span>
              </div>
              <p className="text-xs font-medium tracking-wide text-slate-400 sm:text-sm">
                PT. RMI (RSV MANUFACTURE INDONESIA)
              </p>
            </div>
            <div className="sm:text-right">
              <span className="block text-[0.68rem] font-bold uppercase tracking-widest text-slate-400">
                Formulir Digital
              </span>
              <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
                <FontAwesomeIcon icon={faFilePen} className="h-3.5 w-3.5 text-[#E30613]" />
                <span className="text-sm font-bold tracking-wide text-white">
                  Permintaan Barang
                </span>
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full bg-gradient-to-r from-[#E30613] via-red-500 to-[#E30613]" />
        </header>

        {/* Banner Notifikasi */}
        {notice && (
          <div
            ref={noticeRef}
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mb-6 flex items-start gap-3.5 rounded-xl border p-4 shadow-sm transition-all duration-200 ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50/90 text-red-900"
                : "border-emerald-200 bg-emerald-50/90 text-emerald-900"
            }`}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                notice.tone === "error" ? "bg-red-100 text-[#E30613]" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              <FontAwesomeIcon
                icon={notice.tone === "error" ? faExclamationTriangle : faCheck}
                className="h-4 w-4"
              />
            </div>
            <div className="flex-1 text-sm font-medium leading-relaxed">
              {notice.text}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Tutup notifikasi"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
            >
              <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          
          {/* Section 01: Informasi Permintaan */}
          <Section no="01" title="Informasi Permintaan" subtitle="Request Details">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              
              {/* Tanggal Permintaan */}
              <div>
                <label htmlFor="f-tanggal" className={labelCls}>
                  <FontAwesomeIcon icon={faCalendarDays} className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Tanggal Permintaan {req}
                </label>
                <input
                  id="f-tanggal"
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                />
              </div>

              {/* Tanggal Dibutuhkan */}
              <div>
                <label htmlFor="f-dibutuhkan" className={labelCls}>
                  <FontAwesomeIcon icon={faCalendarDays} className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Tanggal Dibutuhkan
                </label>
                <input
                  id="f-dibutuhkan"
                  type="date"
                  value={tanggalDibutuhkan}
                  onChange={(e) => setTanggalDibutuhkan(e.target.value)}
                  className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                />
              </div>

              {/* Nama Peminta */}
              <div>
                <label htmlFor="f-peminta" className={labelCls}>
                  <FontAwesomeIcon icon={faUser} className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Nama Peminta {req}
                </label>
                <input
                  id="f-peminta"
                  required
                  value={namaPeminta}
                  onChange={(e) => setNamaPeminta(e.target.value)}
                  placeholder="Nama lengkap peminta"
                  className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                />
              </div>

              {/* Divisi */}
              <div>
                <label htmlFor="f-departemen" className={labelCls}>
                  <FontAwesomeIcon icon={faBuilding} className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Divisi {req}
                </label>
                {divisiList.length > 0 && !divisiManual ? (
                  <select
                    id="f-departemen"
                    required
                    value={departemen}
                    onChange={(e) => {
                      if (e.target.value === "__manual__") {
                        setDivisiManual(true);
                        setDepartemen("");
                      } else {
                        setDepartemen(e.target.value);
                      }
                    }}
                    className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                  >
                    <option value="">— Pilih Divisi —</option>
                    {divisiList.map((d) => (
                      <option key={d.id} value={d.nama}>
                        {d.nama}
                      </option>
                    ))}
                    <option value="__manual__">Lainnya (Tulis Manual)</option>
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      id="f-departemen"
                      required
                      value={departemen}
                      onChange={(e) => setDepartemen(e.target.value)}
                      placeholder="Contoh: Produksi, QA, Maintenance"
                      className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                    />
                    {divisiList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDivisiManual(false);
                          setDepartemen("");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#E30613] hover:underline"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
                        Pilih dari daftar divisi
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Kebutuhan Untuk */}
              <div>
                <label htmlFor="f-kebutuhan" className={labelCls}>
                  <FontAwesomeIcon icon={faClipboardList} className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Kebutuhan Untuk
                </label>
                <select
                  id="f-kebutuhan"
                  value={kebutuhanUntuk}
                  onChange={(e) => setKebutuhanUntuk(e.target.value)}
                  className={`${inputCls} transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
                >
                  <option>Produksi</option>
                  <option>Maintenance</option>
                  <option>Proyek</option>
                </select>
              </div>

              {/* Prioritas */}
              <div>
                <label htmlFor="f-prioritas" className={labelCls}>
                  Tingkat Prioritas
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full transition-colors ${
                      prioritas === "Urgent" ? "bg-[#E30613] animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <select
                    id="f-prioritas"
                    value={prioritas}
                    onChange={(e) => setPrioritas(e.target.value)}
                    className={`${inputCls} pl-9 font-bold tracking-wide transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20 ${
                      prioritas === "Urgent" ? "text-[#E30613]" : "text-slate-800"
                    }`}
                  >
                    <option value="Normal">NORMAL</option>
                    <option value="Urgent">URGENT</option>
                  </select>
                </div>
              </div>

            </div>
          </Section>

          {/* Section 02: Detail Barang */}
          <Section no="02" title="Detail Barang" subtitle="Items Request List">
            
            {/* Status Loading / Error Master Data */}
            {masterState === "loading" && (
              <div role="status" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <span>Memuat katalog master barang...</span>
              </div>
            )}
            {masterState === "error" && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs font-medium text-red-900">
                <span>Gagal memuat katalog barang. Anda tetap dapat memasukkan nama barang secara manual.</span>
                <button
                  type="button"
                  onClick={muatMaster}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold text-[#E30613] shadow-sm hover:bg-red-50"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* List Kartu Barang */}
            <div className="space-y-4">
              {baris.map((b, i) => (
                <BarisBarangCard
                  key={i}
                  b={b}
                  index={i}
                  canDelete={baris.length > 1}
                  masterItems={masterItem}
                  error={triedSubmit ? rowError(b, i) : null}
                  onPick={(id) => pilihItem(i, id)}
                  onNama={(text) => namaBebas(i, text)}
                  onField={(field, value) => updateBaris(i, field, value)}
                  onStep={(delta) => stepJumlah(i, delta)}
                  onHapus={() => hapusBarang(i)}
                />
              ))}
            </div>
  {/* Tombol Tambah Barang */}
            <button
              type="button"
              onClick={tambahBarang}
              aria-label={`Tambah barang (saat ini ${baris.length} baris)`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-[#E30613] hover:bg-red-50/30 hover:text-[#E30613] focus:outline-none focus:ring-2 focus:ring-[#E30613]/20"
            >
              <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
              Tambah Barang
            </button>
            {/* Ringkasan Metric Card */}
            <div
              role="status"
              aria-live="polite"
              className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm sm:grid-cols-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-slate-300">
                  <FontAwesomeIcon icon={faLayerGroup} className="h-5 w-5 text-[#E30613]" />
                </div>
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-400">Total Jenis Barang</p>
                  <p className="text-xl font-extrabold tabular-nums text-white">{ringkasan.jenis} <span className="text-xs font-normal text-slate-400">item</span></p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-slate-300">
                  <FontAwesomeIcon icon={faBoxOpen} className="h-5 w-5 text-[#E30613]" />
                </div>
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-400">Total Kuantitas</p>
                  <p className="text-xl font-extrabold tabular-nums text-white">{ringkasan.qty.toLocaleString("id-ID")}</p>
                </div>
              </div>
            </div>

          
          </Section>

          {/* Section 03: Alasan Permintaan */}
          <Section no="03" title="Alasan Permintaan" subtitle="Justification">
            <div>
              <label htmlFor="f-alasan" className={labelCls}>
                 Alasan Permintaan {req}
              </label>
              <textarea
                id="f-alasan"
                rows={4}
                required
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Jelaskan tujuan"
                className={`${inputCls} resize-y transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20`}
              />
            
            </div>
          </Section>

          {/* Action Bar */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#E30613] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/25 transition hover:bg-[#c00510] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:float-right"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>Proses Menyimpan...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faWhatsapp} className="h-4 w-4 text-white" />
                  <span>Simpan </span>
                </>
              )}
            </button>
            <div className="clear-both" />
          </div>

        </form>
      </div>
    </div>
  );
}

export default PermintaanBarang;