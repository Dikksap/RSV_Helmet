import { useRef, useState, type FormEvent } from "react";
import { useReactToPrint } from "react-to-print";
import { createPermintaan } from "../../api/permintaanBarang";

type Baris = {
  nama: string;
  spesifikasi: string;
  jumlah: string;
  satuan: string;
};

type StepId = "A" | "B" | "C" | "D";

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

const inputCls =
  "w-full rounded-md border border-[#dee2e6] bg-white px-3 py-3 text-base transition focus:border-[#1a3c6e] focus:outline-none focus:ring-4 focus:ring-[#1a3c6e]/10 readonly:bg-[#eef1f6] readonly:font-semibold readonly:text-[#1a3c6e]";

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    body * { visibility: hidden !important; }
    #permintaan-paper, #permintaan-paper * {
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #permintaan-paper {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 210mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    #permintaan-paper tr, #permintaan-paper .sig-col { break-inside: avoid !important; }
    #permintaan-paper thead { display: table-header-group !important; }
  }
`;

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
  const [step, setStep] = useState<StepId>("A");
  const [selesai, setSelesai] = useState<Record<StepId, boolean>>({
    A: false, B: false, C: false, D: false,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const printFn = useReactToPrint({
    contentRef: paperRef,
    documentTitle: noPermintaan || "PR-BELUM-DISIMPAN",
    pageStyle: PRINT_STYLE,
    onPrintError: (_location, error) => {
      console.error("Gagal mencetak:", error);
      window.alert(`Gagal mencetak: ${error.message}`);
    },
  });

  const statusOf = (id: StepId): "active" | "completed" | "locked" => {
    if (step === id) return "active";
    if (selesai[id]) return "completed";
    return "locked";
  };

  const lanjutKe = (from: StepId, to: StepId) => {
    const form = formRef.current;
    if (!form) return;
    const container = form.querySelector<HTMLElement>(`[data-step="${from}"]`);
    if (container) {
      const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input[required], select[required], textarea[required]",
      );
      for (const input of inputs) {
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
      }
    }
    if (from === "B") {
      if (baris.length === 0) {
        window.alert("Anda belum menambahkan data barang!");
        return;
      }
      for (const b of baris) {
        if (!b.nama.trim()) {
          window.alert("Nama barang wajib diisi!");
          return;
        }
        if (!b.jumlah || Number(b.jumlah) <= 0) {
          window.alert("Jumlah barang harus lebih dari 0!");
          return;
        }
      }
    }
    setSelesai((prev) => ({ ...prev, [from]: true }));
    setStep(to);
  };

  const bukaStep = (id: StepId) => {
    if (statusOf(id) === "locked") return;
    setStep(id);
  };

  const updateBaris = (index: number, field: keyof Baris, value: string) =>
    setBaris((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const tambahBarang = () =>
    setBaris((prev) => [...prev, { nama: "", spesifikasi: "", jumlah: "", satuan: "" }]);

  const hapusBarang = (index: number) => {
    if (baris.length <= 1) {
      window.alert("Minimal 1 barang!");
      return;
    }
    setBaris((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
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
      // Commit nomor ke DOM pratinjau dulu, baru buka dialog cetak.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      printFn();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal menyimpan permintaan.");
    } finally {
      setSaving(false);
    }
  };

  const stepBox = (id: StepId, title: string, children: React.ReactNode, action: React.ReactNode) => {
    const status = statusOf(id);
    const badge =
      status === "active" ? "✍️ Mengisi" : status === "completed" ? "✅ Selesai" : "🔒 Terkunci";
    const boxCls =
      status === "active"
        ? "border-[#1a3c6e] shadow-[0_4px_15px_rgba(26,60,110,0.15)]"
        : status === "completed"
          ? "border-[#198754]"
          : "border-[#e9ecef] opacity-70";
    const headCls =
      status === "active"
        ? "bg-[#1a3c6e] text-white"
        : status === "completed"
          ? "bg-[#f0fdf4] text-[#198754]"
          : "bg-[#f4f7f6] text-[#adb5bd]";
    const badgeCls =
      status === "active"
        ? "bg-white/20 text-white"
        : status === "completed"
          ? "bg-[#198754] text-white"
          : "bg-[#e9ecef] text-[#6c757d]";
    return (
      <div className={`mb-4 overflow-hidden rounded-[10px] border bg-white transition-all ${boxCls}`} data-step={id}>
        <button
          type="button"
          onClick={() => bukaStep(id)}
          className={`flex w-full items-center justify-between px-5 py-4 text-left font-semibold transition ${headCls} ${status === "locked" ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className="flex items-center gap-2.5 text-[1.05rem]">{title}</span>
          <span className={`rounded-full px-2.5 py-1 text-[0.85rem] font-bold ${badgeCls}`}>{badge}</span>
        </button>
        {status === "active" && (
          <div className="border-t border-[#dee2e6] p-5" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
            {children}
            {action}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] px-4 py-8 text-[#333]">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="mx-auto mb-10 max-w-[800px]">
        <div className="mb-5 rounded-[10px] border-t-4 border-[#1a3c6e] bg-white p-5 text-center shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <h1 className="text-[1.4rem] font-bold text-[#1a3c6e]">PT. HELMINDO PRATAMA INDONESIA</h1>
          <h2 className="text-base font-medium text-[#6c757d]">FORM PERMINTAAN BARANG / BAHAN BAKU</h2>
          <span className="mt-2.5 inline-block rounded-full bg-[#eef1f6] px-3 py-1 text-[0.85rem] font-bold text-[#1a3c6e]">
            No: {noPermintaan || "OTOMATIS SAAT DISIMPAN"}
          </span>
        </div>

        <form ref={formRef} onSubmit={onSubmit}>
          {stepBox("A", "1️⃣ A. Informasi Permintaan", (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#444]">Tanggal Permintaan <span className="text-[#dc3545]">*</span></label>
                <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputCls} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#444]">Departemen <span className="text-[#dc3545]">*</span></label>
                  <input required value={departemen} onChange={(e) => setDepartemen(e.target.value)} placeholder="Contoh: Produksi" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#444]">Nama Peminta <span className="text-[#dc3545]">*</span></label>
                  <input required value={namaPeminta} onChange={(e) => setNamaPeminta(e.target.value)} placeholder="Nama lengkap" className={inputCls} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#444]">Kebutuhan Untuk</label>
                  <select value={kebutuhanUntuk} onChange={(e) => setKebutuhanUntuk(e.target.value)} className={inputCls}>
                    <option>Produksi</option>
                    <option>Maintenance</option>
                    <option>Proyek</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#444]">Prioritas</label>
                  <select value={prioritas} onChange={(e) => setPrioritas(e.target.value)} className={inputCls}>
                    <option>Normal</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#444]">Tgl. Dibutuhkan</label>
                  <input type="date" value={tanggalDibutuhkan} onChange={(e) => setTanggalDibutuhkan(e.target.value)} className={inputCls} />
                </div>
              </div>
            </>
          ), (
            <div className="mt-2.5 text-right">
              <button type="button" onClick={() => lanjutKe("A", "B")} className="rounded-md bg-[#1a3c6e] px-5 py-3 font-semibold text-white">Lanjut ke Bagian B ➔</button>
            </div>
          ))}

          {stepBox("B", "2️⃣ B. Detail Barang", (
            <>
              <div className="mb-5 flex flex-col gap-4">
                {baris.map((b, i) => (
                  <div key={i} className="rounded-lg border border-[#dee2e6] bg-[#fafbfa] p-4">
                    <div className="mb-4 flex items-center justify-between border-b border-dashed border-[#dee2e6] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1a3c6e] text-sm font-bold text-white">{i + 1}</span>
                        <strong className="text-[#1a3c6e]">Data Barang</strong>
                      </div>
                      <button type="button" onClick={() => hapusBarang(i)} title="Hapus" className="grid h-8 w-8 place-items-center rounded border border-[#dc3545]/20 bg-[#dc3545]/10 text-xl text-[#dc3545]">✕</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_1fr]">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-[#444]">Nama Barang / Bahan <span className="text-[#dc3545]">*</span></label>
                        <input required value={b.nama} onChange={(e) => updateBaris(i, "nama", e.target.value)} placeholder="Contoh: Kertas A4" className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-[#444]">Spesifikasi</label>
                        <input value={b.spesifikasi} onChange={(e) => updateBaris(i, "spesifikasi", e.target.value)} placeholder="Merek/Ukuran" className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-[#444]">Jml <span className="text-[#dc3545]">*</span></label>
                          <input type="number" min="1" required value={b.jumlah} onChange={(e) => updateBaris(i, "jumlah", e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-[#444]">Satuan</label>
                          <input value={b.satuan} onChange={(e) => updateBaris(i, "satuan", e.target.value)} placeholder="Pcs/Kg" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={tambahBarang} className="mb-4 w-full rounded-md border-2 border-dashed border-[#1a3c6e] bg-[#eef1f6] px-5 py-3 font-semibold text-[#1a3c6e]">➕ Tambah Barang Lain</button>
            </>
          ), (
            <div className="text-right">
              <button type="button" onClick={() => lanjutKe("B", "C")} className="rounded-md bg-[#1a3c6e] px-5 py-3 font-semibold text-white">Lanjut ke Bagian C ➔</button>
            </div>
          ))}

          {stepBox("C", "3️⃣ C. Alasan Permintaan", (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#444]">Jelaskan Alasan <span className="text-[#dc3545]">*</span></label>
              <textarea rows={3} required value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Wajib diisi..." className={inputCls} />
            </div>
          ), (
            <div className="mt-2.5 text-right">
              <button type="button" onClick={() => lanjutKe("C", "D")} className="rounded-md bg-[#1a3c6e] px-5 py-3 font-semibold text-white">Lanjut ke Ringkasan ➔</button>
            </div>
          ))}

          {stepBox("D", "4️⃣ D. Pratinjau & Cetak PDF", (
            <>
              <p className="mb-4 text-[0.95rem] text-[#555]">
                Periksa pratinjau di bawah. Klik <strong>"Simpan & Cetak PDF"</strong> untuk
                menyimpan ke database sekaligus membuka dialog cetak, lalu pilih
                tujuan <strong>Save as PDF</strong>.
              </p>
              <div className="-mx-5 mb-5 overflow-auto bg-[#e5e7eb] p-4">
                <div
                  id="permintaan-paper"
                  ref={paperRef}
                  className="mx-auto flex w-[210mm] flex-col bg-white px-[16mm] py-[14mm] font-[Arial,Helvetica,sans-serif] text-[9.5pt] leading-normal text-[#1f2937] shadow-[0_10px_25px_rgba(0,0,0,0.15)]"
                >
                  <div className="mb-[6mm] flex items-end justify-between border-b-[3px] border-[#1a3c6e] pb-[3mm]">
                    <div>
                      <div className="text-[16pt] font-extrabold tracking-wide text-[#1a3c6e]">PT. HELMINDO PRATAMA INDONESIA</div>
                      <div className="mt-[0.5mm] text-[8.5pt] text-[#6b7280]">Sistem Inventaris &amp; Barang Produksi</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11pt] font-bold text-[#1a3c6e]">FORM PERMINTAAN BARANG</div>
                    </div>
                  </div>

                  <div className="mb-[6mm] rounded border border-[#d7e0ee] bg-[#f3f6fb] px-[4mm] py-[3mm]">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr>
                          <td className="w-[24%] py-[0.5mm] text-[#6b7280]">No. Permintaan</td>
                          <td className="w-[26%] font-bold">{noPermintaan}</td>
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
                          <td className="font-bold" colSpan={3}>{kebutuhanUntuk}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-wide text-[#1a3c6e]">Detail Barang</div>
                  <table className="mb-[6mm] w-full border-collapse text-[9pt]">
                    <thead>
                      <tr className="bg-[#1a3c6e] text-white">
                        <th className="w-[6%] border border-[#1a3c6e] px-[2.5mm] py-[2mm] text-center">No</th>
                        <th className="border border-[#1a3c6e] px-[2.5mm] py-[2mm] text-left">Nama Barang / Bahan</th>
                        <th className="border border-[#1a3c6e] px-[2.5mm] py-[2mm] text-left">Spesifikasi</th>
                        <th className="w-[10%] border border-[#1a3c6e] px-[2.5mm] py-[2mm] text-center">Jml</th>
                        <th className="w-[14%] border border-[#1a3c6e] px-[2.5mm] py-[2mm] text-center">Satuan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baris.map((b, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}>
                          <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">{i + 1}</td>
                          <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">{b.nama}</td>
                          <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">{b.spesifikasi || "-"}</td>
                          <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">{b.jumlah}</td>
                          <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">{b.satuan || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-wide text-[#1a3c6e]">Alasan Permintaan</div>
                  <div className="mb-[10mm] min-h-[14mm] rounded border border-[#d7e0ee] px-[4mm] py-[3mm]">{alasan}</div>

                  <div className="grid grid-cols-4 text-center text-[9pt]">
                    {[
                      { label: "Dibuat Oleh\n(Peminta)", name: namaPeminta.toUpperCase() },
                      { label: "Diperiksa Oleh\n(Atasan)", name: "" },
                      { label: "Disetujui Oleh\n(Manager)", name: "" },
                      { label: "Diterima Oleh\n(Gudang)", name: "" },
                    ].map((s) => (
                      <div key={s.label} className="sig-col px-[2mm]">
                        <div className="mb-[16mm] whitespace-pre-line text-[#374151]">{s.label}</div>
                        <div className={`border-t border-[#1f2937] pt-[1.5mm] ${s.name ? "font-bold" : ""}`}>
                          {s.name || "(............................)"}
                        </div>
                      </div>
                    ))}
                  </div>

                 
                </div>
              </div>
            </>
          ), (
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="rounded-md bg-[#198754] px-5 py-3 font-semibold text-white disabled:opacity-60">
                {saving ? "Menyimpan..." : "📄 Simpan & Cetak PDF"}
              </button>
            </div>
          ))}
        </form>
      </div>
    </div>
  );
}

export default PermintaanBarang;
