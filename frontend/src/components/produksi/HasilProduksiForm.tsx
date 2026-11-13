import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faCheck,
  faCirclePlus,
  faIndustry,
  faQrcode,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { ModalTransferWip, type ModalTransferWipData } from "./ModalTransferWip";
import type { Divisi } from "../../api/divisi";
import type { Item } from "../../api/item";
import type { ProductionRouting } from "../../api/erp";
import type { VariantProdukRow } from "../../api/products";
import {
  createHasilProduksi,
  HasilProduksiApiError,
  pesanHasilProduksi,
  type HasilProduksiRecord,
} from "../../api/hasilProduksiHarian";
import {
  buildHpPayload,
  emptyRow,
  expectedUnitCount,
  hpFormSignature,
  nextIdempotencyKey,
  stageOptions,
  validateHpForm,
  type HpFormState,
  type LastHpAttempt,
  type RowDraft,
  type StageOption,
} from "./hpForm";

const todayISO = () => new Date().toLocaleDateString("en-CA");
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-100";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";
const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

function newKey() {
  return crypto.randomUUID();
}

type Props = {
  /** Divisi terpilih (dikelola halaman agar stok WIP dan form memakai divisi yang sama). */
  divisiId: string;
  canChangeDivisi: boolean;
  onDivisiChange: (value: string) => void;
  divisions: Divisi[];
  items: Item[];
  routings: ProductionRouting[];
  variants: VariantProdukRow[];
  /** sisa WIP per item pada divisi terpilih */
  wipByItem: Record<number, number>;
  onWipUpdated?: () => void;
  onSaved: (record: HasilProduksiRecord) => void;
  onScan: () => void;
};

export default function HasilProduksiForm({
  divisiId,
  canChangeDivisi,
  onDivisiChange,
  divisions,
  items,
  routings,
  variants,
  wipByItem,
  onWipUpdated,
  onSaved,
  onScan,
}: Props) {
  const [form, setForm] = useState<HpFormState>(() => ({
    tanggal: todayISO(),
    divisiId,
    stageKey: "",
    keterangan: "",
    masuk: [emptyRow(newKey())],
    hasil: [emptyRow(newKey())],
    keluar: [],
  }));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<LastHpAttempt | null>(null);
  const [result, setResult] = useState<HasilProduksiRecord | null>(null);
  const [wipKurang, setWipKurang] = useState<HasilProduksiApiError | null>(null);
  const [transferModalData, setTransferModalData] = useState<ModalTransferWipData | null>(null);

  const divisiNum = Number(form.divisiId);
  const options = useMemo(() => stageOptions(routings, divisiNum), [routings, divisiNum]);
  const option: StageOption | null =
    options.find((row) => row.key === form.stageKey) ?? (options.length === 1 ? options[0] : null);
  const unitCount = expectedUnitCount(form, option);

  const setField = <K extends keyof HpFormState>(key: K, value: HpFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const changeDivisi = (value: string) => {
    onDivisiChange(value);
    setNotice(null);
  };

  const changeStage = (value: string) => {
    setForm((current) => ({
      ...current,
      stageKey: value,
      masuk: [emptyRow(newKey())],
      hasil: [emptyRow(newKey())],
      keluar: [],
    }));
    setNotice(null);
  };

  const updateRow = (
    group: "masuk" | "hasil" | "keluar",
    key: string,
    patch: Partial<RowDraft>,
  ) => {
    setForm((current) => ({
      ...current,
      [group]: current[group].map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
    setNotice(null);
  };

  const addRow = (group: "masuk" | "hasil" | "keluar") => {
    setForm((current) => ({ ...current, [group]: [...current[group], emptyRow(newKey())] }));
  };

  const removeRow = (group: "masuk" | "hasil" | "keluar", key: string) => {
    setForm((current) => ({
      ...current,
      [group]: current[group].filter((row) => row.key !== key),
    }));
  };

  const submit = async () => {
    if (saving || !option) return;
    const errors = validateHpForm(form, option);
    if (errors.length > 0) {
      setNotice({ tone: "error", text: errors[0] });
      return;
    }
    setSaving(true);
    setNotice(null);
    setWipKurang(null);
    const signature = hpFormSignature(form, option);
    const idempotencyKey = nextIdempotencyKey(signature, lastAttempt);
    try {
      const record = await createHasilProduksi(buildHpPayload(form, option, idempotencyKey));
      setResult(record);
      setLastAttempt(null);
      setForm((current) => ({
        ...current,
        keterangan: "",
        masuk: [emptyRow(newKey())],
        hasil: [emptyRow(newKey())],
        keluar: [],
      }));
      setNotice({
        tone: "ok",
        text: `Dokumen ${record.nomor} tersimpan. ${record.items
          .filter((row) => row.tipe === "HASIL")
          .reduce((total, row) => total + row.barangDihasilkan.length, 0)
          .toLocaleString("id-ID")} unit QR dibuat.`,
      });
      onSaved(record);
    } catch (error) {
      if (error instanceof HasilProduksiApiError && error.code === "WIP_KURANG") {
        setWipKurang(error);
      }
      // Key dipertahankan hanya untuk retry payload identik.
      setLastAttempt({ signature, idempotencyKey });
      setNotice({ tone: "error", text: pesanHasilProduksi(error) });
    } finally {
      setSaving(false);
    }
  };

  const generatedUnits = result
    ? result.items.flatMap((row) => row.barangDihasilkan)
    : [];

  if (divisions.length === 0) {
    return (
      <section className={cardCls}>
        <p className="text-sm text-slate-500">Belum ada master divisi.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <FontAwesomeIcon
            icon={notice.tone === "ok" ? faCheck : faTriangleExclamation}
            className="mr-2"
          />
          {notice.text}
        </div>
      )}

      {wipKurang?.dataKekurangan && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">Kekurangan WIP</p>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-amber-700">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Tersedia</th>
                <th className="py-1 text-right">Dibutuhkan</th>
                <th className="py-1 text-right">Kurang</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1">
                  {wipKurang.dataKekurangan.itemKode} · {wipKurang.dataKekurangan.itemNama}
                </td>
                <td className="py-1 text-right tabular-nums">{wipKurang.dataKekurangan.wipTersedia.toLocaleString("id-ID")}</td>
                <td className="py-1 text-right tabular-nums">{wipKurang.dataKekurangan.jumlahMasuk.toLocaleString("id-ID")}</td>
                <td className="py-1 text-right font-bold tabular-nums">{wipKurang.dataKekurangan.kekurangan.toLocaleString("id-ID")} {wipKurang.dataKekurangan.unit}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-red-200/80 pt-2.5">
            <div>
              {wipKurang.permintaanBarang && (
                <p className="text-xs">
                  Permintaan barang otomatis dibuat: <span className="font-bold">{wipKurang.permintaanBarang.noPermintaan}</span>
                </p>
              )}
              {wipKurang.saranTransfer && (
                <p className="text-xs">
                  Dapat dipenuhi lewat transfer WIP dari divisi{" "}
                  <span className="font-bold">{wipKurang.saranTransfer.divisiAsalNama ?? wipKurang.saranTransfer.divisiAsalId}</span>.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const dataKekurangan = wipKurang.dataKekurangan;
                if (!dataKekurangan) return;

                const divisiTujuanId = dataKekurangan.divisiId ?? divisiNum;
                const divisiObj = divisions.find((d) => d.id === divisiTujuanId);
                setTransferModalData({
                  itemId: dataKekurangan.itemId,
                  itemKode: dataKekurangan.itemKode,
                  itemNama: dataKekurangan.itemNama,
                  unit: dataKekurangan.unit,
                  jumlahDibutuhkan: dataKekurangan.kekurangan,
                  divisiTujuanId,
                  divisiTujuanNama: divisiObj?.nama ?? `Divisi ${divisiTujuanId}`,
                  divisiAsalId: wipKurang.saranTransfer?.divisiAsalId ?? null,
                  divisiAsalNama: wipKurang.saranTransfer?.divisiAsalNama ?? null,
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-red-700 active:scale-95 transition"
            >
              <FontAwesomeIcon icon={faArrowRightArrowLeft} />
              <span>Transfer / Tambah Saldo WIP</span>
            </button>
          </div>
        </div>
      )}

      <section className={cardCls}>
        <h2 className="text-sm font-extrabold text-[#1E3A5F]">Header Produksi</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelCls}>Tanggal produksi</span>
            <input
              type="date"
              value={form.tanggal}
              max={todayISO()}
              onChange={(event) => setField("tanggal", event.target.value)}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Divisi</span>
            <select
              value={form.divisiId}
              onChange={(event) => changeDivisi(event.target.value)}
              disabled={!canChangeDivisi}
              className={inputCls}
            >
              <option value="">Pilih divisi</option>
              {divisions.map((row) => (
                <option key={row.id} value={row.id}>{row.nama}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Tahap routing</span>
            <select
              value={option?.key ?? ""}
              onChange={(event) => changeStage(event.target.value)}
              disabled={!divisiId || options.length === 0}
              className={inputCls}
            >
              <option value="">
                {!divisiId
                  ? "Pilih divisi dulu"
                  : options.length === 0
                    ? "Routing belum dikonfigurasi"
                    : "Pilih tahap"}
              </option>
              {options.map((row) => (
                <option key={row.key} value={row.key}>
                  v{row.routingVersion} · {row.stage}
                  {row.isLast ? " (tahap akhir)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {divisiNum > 0 && options.length === 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Routing produksi untuk divisi ini belum dikonfigurasi. Minta admin mengatur Routing Produksi
            sebelum mencatat hasil produksi.
          </p>
        )}
        <label className="mt-3 block">
          <span className={labelCls}>Keterangan</span>
          <textarea
            rows={2}
            value={form.keterangan}
            onChange={(event) => setField("keterangan", event.target.value)}
            placeholder="Opsional"
            className={inputCls}
          />
        </label>
      </section>

      {option && (
        <>
          <RowGroup
            title="MASUK — material/WIP yang dipakai"
            hint={`Stok diambil dari lot WIP divisi. Stage ${option.stage} menerima: ${option.inputs.map((row) => row.kode).join(", ")}.`}
            group="masuk"
            rows={form.masuk}
            options={option.inputs}
            wipByItem={wipByItem}
            onUpdate={updateRow}
            onAdd={() => addRow("masuk")}
            onRemove={removeRow}
          />

          <RowGroup
            title="HASIL — output proses"
            hint={
              option.isLast
                ? (option.outputs.length === 0
                    ? "Tahap akhir (Perakitan): output berupa ProductVariant (helm jadi). Unit QR akan otomatis dibuat."
                    : `Tahap akhir: setiap baris wajib memilih ProductVariant. Output stage: ${option.outputs.map((row) => row.kode).join(", ")}.`)
                : `Output WIP/Item: ${option.outputs.map((row) => row.kode).join(", ")}. ProductVariant hanya untuk tahap akhir.`
            }
            group="hasil"
            rows={form.hasil}
            options={option.outputs}
            wipByItem={{}}
            onUpdate={updateRow}
            onAdd={() => addRow("hasil")}
            onRemove={removeRow}
            variants={option.isLast ? variants : undefined}
            isVariantOnly={option.isLast && (option.outputs.length === 0 || !option.outputs.some((o) => o.itemId))}
          />

          <section className={cardCls}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">KELUAR (opsional)</h2>
              <button
                type="button"
                onClick={() => addRow("keluar")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <FontAwesomeIcon icon={faCirclePlus} /> Tambah
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Pengeluaran stok item dari lokasi divisi. Tidak boleh memakai item yang sama dengan baris MASUK.
            </p>
            <div className="mt-3 space-y-2">
              {form.keluar.map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                  <select
                    value={row.itemId}
                    onChange={(event) => updateRow("keluar", row.key, { itemId: event.target.value })}
                    className={inputCls}
                  >
                    <option value="">Pilih item</option>
                    {items.filter((item) => item.isActive).map((item) => (
                      <option key={item.id} value={item.id}>{item.kode} — {item.nama}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Jumlah"
                    value={row.jumlah}
                    onChange={(event) => updateRow("keluar", row.key, { jumlah: event.target.value })}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    aria-label="Hapus baris KELUAR"
                    onClick={() => removeRow("keluar", row.key)}
                    className="rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50"
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              ))}
              {form.keluar.length === 0 && (
                <p className="text-xs text-slate-400">Tidak ada pengeluaran stok.</p>
              )}
            </div>
          </section>

          <section className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Ringkasan</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Stage <span className="font-bold">{option.stage}</span>
                  {option.isLast ? " (tahap akhir)" : ""} · {form.masuk.length} baris MASUK ·{" "}
                  {form.hasil.length} baris HASIL
                  {option.isLast ? ` · ${unitCount.toLocaleString("id-ID")} unit QR akan dibuat` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-3 text-sm font-bold text-white hover:bg-[#152c49] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FontAwesomeIcon icon={saving ? faSpinner : faIndustry} spin={saving} />
                {saving ? "Menyimpan..." : "Simpan Hasil Produksi"}
              </button>
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-emerald-900">Dokumen {result.nomor}</h2>
              <p className="mt-1 text-xs text-emerald-800">
                Stage {result.routingStage?.stage ?? "-"}
                {result.bom ? ` · BOM versi ${result.bom.version}` : " · tanpa BOM"}
                {generatedUnits.length > 0 ? ` · ${generatedUnits.length} unit QR dibuat` : ""}
              </p>
            </div>
            {generatedUnits.length > 0 && (
              <button
                type="button"
                onClick={onScan}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
              >
                <FontAwesomeIcon icon={faQrcode} /> Scan FINISHGOOD
              </button>
            )}
          </div>
          {generatedUnits.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-white/70 p-2">
              <ul className="grid gap-1 text-[11px] text-emerald-900 sm:grid-cols-2 lg:grid-cols-3">
                {generatedUnits.map((unit) => (
                  <li key={unit.id} className="font-mono">{unit.kodeBarang}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {transferModalData && (
        <ModalTransferWip
          data={transferModalData}
          onClose={() => setTransferModalData(null)}
          onSuccess={(msg) => {
            setTransferModalData(null);
            setWipKurang(null);
            setNotice({ tone: "ok", text: msg });
            onWipUpdated?.();
          }}
        />
      )}
    </div>
  );
}

type RowGroupProps = {
  title: string;
  hint: string;
  group: "masuk" | "hasil";
  rows: RowDraft[];
  options: { itemId: number; kode: string; nama: string; unit: string | null }[];
  wipByItem: Record<number, number>;
  variants?: VariantProdukRow[];
  isVariantOnly?: boolean;
  onUpdate: (group: "masuk" | "hasil" | "keluar", key: string, patch: Partial<RowDraft>) => void;
  onAdd: () => void;
  onRemove: (group: "masuk" | "hasil" | "keluar", key: string) => void;
};

function RowGroup({
  title,
  hint,
  group,
  rows,
  options,
  wipByItem,
  variants,
  isVariantOnly,
  onUpdate,
  onAdd,
  onRemove,
}: RowGroupProps) {
  return (
    <section className={cardCls}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-[#1E3A5F]">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faCirclePlus} /> Tambah
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const wip = wipByItem[Number(row.itemId)];
          return (
            <div key={row.key} className="rounded-xl border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                {isVariantOnly && variants ? (
                  <label className="block">
                    <span className={labelCls}>ProductVariant (Helm Jadi)</span>
                    <select
                      value={row.productVariantId}
                      onChange={(event) =>
                        onUpdate(group, row.key, { productVariantId: event.target.value })
                      }
                      className={inputCls}
                    >
                      <option value="">Pilih varian produk</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.kodeVariant} · {variant.namaProduk} {variant.namaStyle} {variant.namaColor} {variant.namaSize}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block">
                    <span className={labelCls}>Item</span>
                    <select
                      value={row.itemId}
                      onChange={(event) => onUpdate(group, row.key, { itemId: event.target.value })}
                      className={inputCls}
                    >
                      <option value="">Pilih item</option>
                      {options.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.kode} — {item.nama}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className={labelCls}>Jumlah</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={row.jumlah}
                    onChange={(event) => onUpdate(group, row.key, { jumlah: event.target.value })}
                    className={inputCls}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    aria-label={`Hapus baris ${group}`}
                    onClick={() => onRemove(group, row.key)}
                    className="h-[42px] w-full rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50 sm:w-10"
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              </div>
              {!isVariantOnly && variants && (
                <label className="mt-2 block">
                  <span className={labelCls}>ProductVariant (wajib)</span>
                  <select
                    value={row.productVariantId}
                    onChange={(event) =>
                      onUpdate(group, row.key, { productVariantId: event.target.value })
                    }
                    className={inputCls}
                  >
                    <option value="">Pilih varian produk</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.kodeVariant} · {variant.namaProduk} {variant.namaStyle} {variant.namaColor} {variant.namaSize}
                      </option>
                    ))}
                  </select>
                  {variants.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Belum ada ProductVariant. Tambahkan varian produk terlebih dahulu.
                    </p>
                  )}
                </label>
              )}
              {group === "masuk" && row.itemId && (
                <p className="mt-2 text-[11px] text-slate-500">
                  WIP tersedia di divisi ini:{" "}
                  <span className={`font-bold ${(wip ?? 0) < Number(row.jumlah || 0) ? "text-amber-700" : "text-emerald-700"}`}>
                    {(wip ?? 0).toLocaleString("id-ID")}
                  </span>
                </p>
              )}
              <input
                type="text"
                value={row.keterangan}
                onChange={(event) => onUpdate(group, row.key, { keterangan: event.target.value })}
                placeholder="Keterangan baris (opsional)"
                className={`${inputCls} mt-2`}
              />
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            Belum ada baris. Klik “Tambah”.
          </p>
        )}
      </div>
    </section>
  );
}
