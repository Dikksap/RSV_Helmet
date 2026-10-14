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

  const muatMaster = () => {
    setMasterState("loading");
    getItems({ aktif: true })
      .then((rows) => {
        setMasterItem(rows);
        setMasterState("ready");
      })
      .catch(() => {
        setMasterItem([]);
        setMasterState("error");
      });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat master sekali saat mount
    muatMaster();
    // Fetch polos (tanpa redirect login ala api client) karena halaman publik.
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"}/divisi`)
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
        // Detail ikut master database: kode, nama, satuan, divisi dikunci.
        return { ...b, itemId: id, kode: m.kode, nama: m.nama, satuan: m.unit, divisi: m.divisi?.nama ?? "" };
      }),
    );

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
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-8 text-[#171717] sm:px-6">
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
                Form Permintaan
              </div>
              <div className="mt-1 inline-block rounded border border-white/20 bg-white/5 px-3 py-1.5 text-[0.95rem] font-bold tracking-wide text-white">
                Barang
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
                    className={inputCls}
                  >
                    <option value="">— Pilih divisi —</option>
                    {divisiList.map((d) => (
                      <option key={d.id} value={d.nama}>{d.nama}</option>
                    ))}
                    <option value="__manual__">Lainnya — tulis manual</option>
                  </select>
                ) : (
                  <>
                    <input
                      id="f-departemen"
                      required
                      value={departemen}
                      onChange={(e) => setDepartemen(e.target.value)}
                      placeholder="Contoh: Produksi"
                      className={inputCls}
                    />
                    {divisiList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDivisiManual(false);
                          setDepartemen("");
                        }}
                        className="mt-1 text-[0.78rem] font-semibold text-[#E30613] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
                      >
                        ← Kembali pilih dari daftar
                      </button>
                    )}
                  </>
                )}
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
            {/* Status master item */}
            {masterState === "loading" && (
              <p role="status" className="animate-pulse text-[0.85rem] text-[#A3A3A3]">
                Memuat data barang...
              </p>
            )}
            {masterState === "error" && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E30613]/30 bg-[#E30613]/5 px-4 py-3 text-[0.85rem] text-[#171717]">
                <span>Gagal memuat data barang. Silakan tulis nama barang secara manual.</span>
                <button
                  type="button"
                  onClick={muatMaster}
                  className="rounded-lg border border-[#E30613]/40 px-3 py-1.5 font-semibold text-[#E30613] transition hover:bg-[#E30613]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {/* Kartu barang responsif: satu render untuk desktop & HP */}
            <div className="flex flex-col gap-4">
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

            {/* Ringkasan otomatis */}
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-[#0B0B0B] px-5 py-3 text-white"
            >
              <span className="text-[0.85rem]">
                Jenis barang: <strong className="tabular-nums">{ringkasan.jenis}</strong>
              </span>
              <span className="text-[0.85rem]">
                Total kuantitas: <strong className="tabular-nums">{ringkasan.qty.toLocaleString("id-ID")}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={tambahBarang}
              aria-label={`Tambah barang (saat ini ${baris.length} baris)`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B0B0B] px-5 py-3.5 text-[0.9rem] font-bold uppercase tracking-wider text-white transition hover:bg-[#E30613] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E30613]/30"
            >
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
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

          <div className="mb-5">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#E30613] px-8 py-3.5 text-[0.95rem] font-bold uppercase tracking-wider text-white shadow-[0_1px_3px_rgba(227,6,19,0.4)] transition hover:bg-[#B80510] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[280px] sm:float-right"
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
            <div className="clear-both" />
          </div>
        </form>
      </div>
    </div>
  );
}

export default PermintaanBarang;
