import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronRight,
  faCircleCheck,
  faClock,
  faClipboardList,
  faFileCsv,
  faLock,
  faMagnifyingGlass,
  faRotate,
  faSpinner,
  faTrash,
  faTriangleExclamation,
  faUndo,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import {
  listPermintaan,
  setApprovalPermintaan,
  deletePermintaan,
  type ApprovalPermintaan,
  type PermintaanBarangRecord,
} from "../../api/permintaanBarang";
import { downloadCsv } from "../../lib/csv";
import { getUser, hasPermission } from "../../api/auth";
import KeputusanApprovalModal from "../../components/admin/DaftarPermintaan/KeputusanApprovalModal";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 " +
  `placeholder:text-slate-400 outline-none transition ${FOCUS} ` +
  "focus:border-[#00A8E8]";

type FilterStatus = "SEMUA" | ApprovalPermintaan;

const approvalBadge = (status: ApprovalPermintaan) => {
  if (status === "DISETUJUI") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25";
  }

  return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/25";
};

const approvalLabel = (status: ApprovalPermintaan) => {
  return status === "DISETUJUI" ? "Disetujui" : "Belum disetujui";
};

const priorityBadge = (prioritas: string) => {
  if (prioritas === "Sangat Urgent") {
    return "bg-red-600 text-white";
  }

  if (prioritas === "Urgent") {
    return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/25";
  }

  return "bg-slate-100 text-slate-600";
};

const isUrgent = (prioritas: string) =>
  prioritas.toLowerCase().includes("urgent");

const formatTanggal = (iso: string | null) => {
  if (!iso) return "-";

  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

/* Format vendor: bulan/hari/tahun tanpa nol depan, cth. 10/3/2026. */
const formatTanggalVendor = (iso: string | null) => {
  if (!iso) return "";

  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? iso
    : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

const formatTanggalLengkap = (iso: string | null) => {
  if (!iso) return "-";

  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};

const ringkasIsi = (record: PermintaanBarangRecord) => {
  const pcs = record.items.reduce((total, item) => total + item.jumlah, 0);

  return {
    items: record.items.length,
    pcs,
  };
};

/* Baris CSV sebagai tabel (unknown[][]) untuk lib/csv.ts:
   ringkas = 1 baris per permintaan, rincian = 1 baris per barang,
   vendor = 1 baris per (tanggal + kode item), hanya
   TANGGAL/Product Code/Jumlah yang diisi, sisanya dikosongkan. */
const buildCsvRows = (
  rows: PermintaanBarangRecord[],
  mode: "ringkas" | "rincian" | "vendor",
): unknown[][] => {
  const permintaanCols = (record: PermintaanBarangRecord): unknown[] => [
    record.noPermintaan,
    formatTanggal(record.tanggal),
    record.departemen,
    record.namaPeminta,
    record.kebutuhanUntuk || "",
    record.prioritas,
    formatTanggal(record.tanggalDibutuhkan),
    record.alasan || "",
    approvalLabel(record.approval),
  ];

  if (mode === "rincian") {
    return [
      [
        "No Permintaan",
        "Tanggal",
        "Departemen",
        "Nama Peminta",
        "Kebutuhan Untuk",
        "Prioritas",
        "Tanggal Dibutuhkan",
        "Alasan",
        "Status",
        "Nama Barang",
        "Spesifikasi",
        "Jumlah",
        "Satuan",
      ],
      ...rows.flatMap((record) =>
        record.items.map((item) => [
          ...permintaanCols(record),
          item.nama,
          item.spesifikasi || "",
          item.jumlah,
          item.satuan || "",
        ]),
      ),
    ];
  }

  if (mode === "vendor") {
    const gabung = new Map<string, { iso: string; tanggal: string; kode: string; nama: string; jumlah: number }>();
    for (const record of rows) {
      const iso = (record.tanggal ?? "").slice(0, 10);
      const tanggal = formatTanggalVendor(record.tanggal);
      for (const item of record.items) {
        const qty = item.jumlahDisetujui ?? 0;
        if (!Number.isInteger(qty) || qty <= 0) continue;
        const kode = item.item?.kode ?? "(tanpa kode)";
        const key = `${iso}||${kode}`;
        const ada = gabung.get(key);
        if (ada) {
          ada.jumlah += qty;
        } else {
          gabung.set(key, { iso, tanggal, kode, nama: item.nama, jumlah: qty });
        }
      }
    }
    const urut = [...gabung.values()].sort((a, b) =>
      a.iso === b.iso ? a.kode.localeCompare(b.kode) : a.iso.localeCompare(b.iso),
    );
    return [
      ["NO", "KODE", "TANGGAL", "", "Product Code", "Product Name", "unit", "Jumlah", "jenis item", "Sub item", "Divisi / dari"],
      ...urut.map((g) => ["", "", g.tanggal, "", g.kode, "", "", g.jumlah, "", "", ""]),
    ];
  }

  return [
    [
      "No Permintaan",
      "Tanggal",
      "Departemen",
      "Nama Peminta",
      "Kebutuhan Untuk",
      "Prioritas",
      "Tanggal Dibutuhkan",
      "Alasan",
      "Status",
      "Jumlah Jenis",
      "Total Pcs",
    ],
    ...rows.map((record) => {
      const summary = ringkasIsi(record);
      return [...permintaanCols(record), summary.items, summary.pcs];
    }),
  ];
};

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  hint,
  icon,
  iconCls,
  valueCls,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof faClipboardList;
  iconCls: string;
  valueCls: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs ${iconCls}`}
        >
          <FontAwesomeIcon icon={icon} />
        </span>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>
        {value.toLocaleString("id-ID")}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function DetailDrawer({
  record,
  busy,
  canApprove,
  isAdmin,
  onClose,
  onSetujui,
  onBatalkan,
  onHapus,
}: {
  record: PermintaanBarangRecord;
  busy: boolean;
  canApprove: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onSetujui: (record: PermintaanBarangRecord) => void;
  onBatalkan: (record: PermintaanBarangRecord) => void;
  onHapus: (record: PermintaanBarangRecord) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const summary = ringkasIsi(record);
  const approved = record.approval === "DISETUJUI";

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permintaan-drawer-title"
      className="fixed inset-0 z-50"
    >
      <style>{`@media (prefers-reduced-motion: no-preference) {
        @keyframes drawer-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        .drawer-panel { animation: drawer-in 160ms ease-out; }
        .drawer-backdrop { animation: backdrop-in 160ms ease-out; }
      }`}</style>

      <button
        type="button"
        aria-label="Tutup detail permintaan"
        onClick={onClose}
        className="drawer-backdrop absolute inset-0 cursor-default bg-slate-900/40"
      />

      <aside className="drawer-panel absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="permintaan-drawer-title"
              className="truncate font-mono text-base font-bold text-[#1E3A5F]"
            >
              {record.noPermintaan}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${approvalBadge(record.approval)}`}
              >
                {approved && (
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="mr-1 text-[10px]"
                    aria-hidden="true"
                  />
                )}
                {approvalLabel(record.approval)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityBadge(record.prioritas)}`}
              >
                {isUrgent(record.prioritas) && (
                  <FontAwesomeIcon
                    icon={faTriangleExclamation}
                    className="mr-1 text-[10px]"
                    aria-hidden="true"
                  />
                )}
                {record.prioritas}
              </span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup detail"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS}`}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            {[
              ["Departemen", record.departemen],
              ["Nama peminta", record.namaPeminta],
              ["Tanggal permintaan", formatTanggalLengkap(record.tanggal)],
              ["Tanggal dibutuhkan", formatTanggalLengkap(record.tanggalDibutuhkan)],
              ["Kebutuhan untuk", record.kebutuhanUntuk || "-"],
            ].map(([term, value]) => (
              <div key={term} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {term}
                </dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-slate-700">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Alasan / keterangan
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {record.alasan || "-"}
            </p>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1E3A5F]">Daftar barang</h3>
              <p className="text-xs tabular-nums text-slate-400">
                {summary.items} jenis · {summary.pcs.toLocaleString("id-ID")} pcs
              </p>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {record.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {item.nama}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {item.spesifikasi || "Tanpa spesifikasi"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-slate-700">
                    {item.jumlah.toLocaleString("id-ID")}{" "}
                    <span className="font-medium text-slate-400">
                      {item.satuan || ""}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {approved && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              <FontAwesomeIcon icon={faLock} className="mt-0.5" aria-hidden="true" />
              Permintaan yang disetujui terkunci dan tidak dapat diubah atau
              dihapus.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          {!approved ? (
            <>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onHapus(record)}
                  className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                >
                  {busy ? (
                    <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                  ) : (
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                  )}
                  Hapus
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSetujui(record)}
                  className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                >
                  {busy ? (
                    <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                  ) : (
                    <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                  )}
                  {busy ? "Memproses…" : "Setujui Permintaan"}
                </button>
              )}
            </>
          ) : (
            canApprove && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onBatalkan(record)}
                className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
              >
                {busy ? (
                  <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                ) : (
                  <FontAwesomeIcon icon={faUndo} aria-hidden="true" />
                )}
                Batalkan Persetujuan
              </button>
            )
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DaftarPermintaan() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("SEMUA");
  const [exportMode, setExportMode] = useState<"ringkas" | "rincian" | "vendor">("ringkas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [rows, setRows] = useState<PermintaanBarangRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [keputusanFor, setKeputusanFor] = useState<PermintaanBarangRecord | null>(null);
  const isAdmin = getUser()?.role === "admin";
  const canApprove = isAdmin || hasPermission("KELOLA_ITEM");

  const [refreshing, setRefreshing] = useState(false);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(noticeTimer.current);
  }, []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current));
    }, 3000);
  }, []);

  const load = useCallback(
    async (status: FilterStatus, showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await listPermintaan({
          limit: 100,
          ...(status === "SEMUA" ? {} : { approval: status }),
          ...(dateFrom ? { dari: dateFrom } : {}),
          ...(dateTo ? { sampai: dateTo } : {}),
        });

        setRows(response.data);
        setError(null);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Gagal memuat daftar permintaan.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, dateFrom, dateTo, load]);

  const changeFilter = (status: FilterStatus) => {
    setFilter(status);
    setSelectedId(null);
  };

  const resetFilter = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    changeFilter("SEMUA");
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCsv(
      `permintaan-barang-${exportMode}-${stamp}.csv`,
      buildCsvRows(filtered, exportMode),
    );
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((record) => {
      return (
        record.noPermintaan.toLowerCase().includes(query) ||
        record.namaPeminta.toLowerCase().includes(query) ||
        record.departemen.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  const statistics = useMemo(() => {
    const belumDisetujui = rows.filter(
      (row) => row.approval === "BELUM_DISETUJUI",
    ).length;

    const disetujui = rows.filter(
      (row) => row.approval === "DISETUJUI",
    ).length;

    const urgent = rows.filter((row) => isUrgent(row.prioritas)).length;

    return {
      total: rows.length,
      belumDisetujui,
      disetujui,
      urgent,
    };
  }, [rows]);

  const detail =
    selectedId === null
      ? null
      : (rows.find((row) => row.id === selectedId) ?? null);

  // Drawer menunjuk ke record yang sudah tidak ada (mis. terhapus atau
  // keluar dari filter): tutup agar tidak menampilkan data basi.
  useEffect(() => {
    if (selectedId !== null && detail === null && !loading) {
      setSelectedId(null);
    }
  }, [selectedId, detail, loading]);

  const setujui = (record: PermintaanBarangRecord) => {
    setKeputusanFor(record);
  };

  const selesaiSetujui = async (message: string) => {
    setKeputusanFor(null);
    flash(message);
    await load(filter);
  };

  const batalkan = async (record: PermintaanBarangRecord) => {
    if (
      !window.confirm(
        `Batalkan persetujuan ${record.noPermintaan}?\n\nPermintaan dapat diubah kembali setelah persetujuan dibatalkan.`,
      )
    ) {
      return;
    }

    setBusyId(record.id);

    try {
      await setApprovalPermintaan(record.id, "BELUM_DISETUJUI");

      flash(`Persetujuan ${record.noPermintaan} dibatalkan.`);

      await load(filter);
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Gagal membatalkan persetujuan.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const hapus = async (record: PermintaanBarangRecord) => {
    if (record.approval === "DISETUJUI") {
      window.alert(
        `Permintaan ${record.noPermintaan} sudah disetujui dan tidak dapat dihapus.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Hapus permintaan ${record.noPermintaan}?\n\nData yang sudah dihapus tidak dapat dikembalikan.`,
      )
    ) {
      return;
    }

    setBusyId(record.id);

    try {
      await deletePermintaan(record.id);

      if (selectedId === record.id) {
        setSelectedId(null);
      }

      flash(`Permintaan ${record.noPermintaan} berhasil dihapus.`);

      await load(filter);
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Gagal menghapus permintaan.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleExpanded = (id: number) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const filterActive =
    search.trim() !== "" ||
    filter !== "SEMUA" ||
    dateFrom !== "" ||
    dateTo !== "";
  const closeDetail = useCallback(() => setSelectedId(null), []);

  return (
    <div className="min-h-full space-y-5 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <p className="text-xs font-medium text-slate-500">
              Warehouse{" "}
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>{" "}
              <span aria-current="page" className="text-slate-700">
                Permintaan Barang
              </span>
            </p>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1E3A5F]">
            Daftar Permintaan
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Kelola permintaan barang antar departemen: tinjau detail, setujui,
            atau hapus permintaan yang belum diperlukan.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void load(filter, true)}
          aria-label={refreshing ? "Memuat ulang data…" : "Muat ulang data"}
          className={`inline-flex min-h-[40px] w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#00A8E8]/40 hover:text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
        >
          <FontAwesomeIcon
            icon={refreshing ? faSpinner : faRotate}
            spin={refreshing}
            aria-hidden="true"
          />
          {refreshing ? "Memuat…" : "Refresh"}
        </button>
      </header>

      {/* Notification */}
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 sm:flex-row sm:items-center"
          >
            <p className="flex flex-1 items-start gap-2.5">
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                <span className="font-semibold">Gagal memuat data. </span>
                {error}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void load(filter)}
              className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 ${FOCUS}`}
            >
              <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
              Coba lagi
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p className="font-medium">{notice}</p>
          </div>
        )}
      </div>

      {/* Statistik ringkas */}
      {loading ? (
        <section aria-label="Memuat statistik" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-7 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </section>
      ) : (
        !error && (
          <section aria-label="Ringkasan permintaan">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Permintaan"
                value={statistics.total}
                hint="Sesuai filter aktif"
                icon={faClipboardList}
                iconCls="bg-sky-50 text-[#00A8E8]"
                valueCls="text-[#1E3A5F]"
              />
              <StatCard
                label="Belum Disetujui"
                value={statistics.belumDisetujui}
                hint="Menunggu pemeriksaan"
                icon={faClock}
                iconCls="bg-amber-50 text-amber-600"
                valueCls="text-amber-600"
              />
              <StatCard
                label="Disetujui"
                value={statistics.disetujui}
                hint="Data terkunci"
                icon={faCircleCheck}
                iconCls="bg-emerald-50 text-emerald-600"
                valueCls="text-emerald-600"
              />
              <StatCard
                label="Prioritas Urgent"
                value={statistics.urgent}
                hint="Butuh perhatian"
                icon={faTriangleExclamation}
                iconCls="bg-red-50 text-red-600"
                valueCls="text-red-600"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Dihitung dari maks. 100 data terbaru yang dimuat, bukan seluruh
              database.
            </p>
          </section>
        )
      )}

      {/* Tabel + toolbar */}
      {!loading && !error && (
        <section
          aria-label="Data permintaan"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          {/* Toolbar terintegrasi */}
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <label htmlFor="permintaan-search" className="sr-only">
                Cari permintaan
              </label>
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                id="permintaan-search"
                type="search"
                className={`${inputCls} pl-10`}
                placeholder="Cari nomor, peminta, departemen…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="permintaan-date-from"
                  className="shrink-0 text-xs font-semibold text-slate-500"
                >
                  Dari
                </label>
                <input
                  id="permintaan-date-from"
                  type="date"
                  className={`${inputCls} sm:w-40`}
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="permintaan-date-to"
                  className="shrink-0 text-xs font-semibold text-slate-500"
                >
                  Sampai
                </label>
                <input
                  id="permintaan-date-to"
                  type="date"
                  className={`${inputCls} sm:w-40`}
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="permintaan-filter" className="sr-only">
                  Filter status approval
                </label>
                <select
                  id="permintaan-filter"
                  className={`${inputCls} sm:w-48`}
                  value={filter}
                  onChange={(event) =>
                    changeFilter(event.target.value as FilterStatus)
                  }
                >
                  <option value="SEMUA">Semua status</option>
                  <option value="BELUM_DISETUJUI">Belum disetujui</option>
                  <option value="DISETUJUI">Disetujui</option>
                </select>
              </div>

              {filterActive && (
                <button
                  type="button"
                  onClick={resetFilter}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 ${FOCUS}`}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                  Reset
                </button>
              )}

              <div>
                <label htmlFor="permintaan-export-mode" className="sr-only">
                  Isi file export CSV
                </label>
                <select
                  id="permintaan-export-mode"
                  className={`${inputCls} sm:w-44`}
                  value={exportMode}
                  onChange={(event) =>
                    setExportMode(event.target.value as "ringkas" | "rincian" | "vendor")
                  }
                >
                  <option value="ringkas">Ringkasan per permintaan</option>
                  <option value="rincian">Rincian per barang</option>
                  <option value="vendor">Vendor per item (gabung)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={exportCsv}
                disabled={filtered.length === 0}
                aria-label={
                  filtered.length === 0
                    ? "Tidak ada data untuk diekspor"
                    : `Ekspor ${exportMode === "rincian" ? "rincian barang" : exportMode === "vendor" ? "vendor per item" : `${filtered.length} permintaan`} ke CSV`
                }
                title="Ekspor data tampil ke CSV"
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-[#00A8E8]/40 hover:text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
              >
                <FontAwesomeIcon icon={faFileCsv} aria-hidden="true" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-5">
            <p className="text-xs text-slate-500" role="status">
              Menampilkan{" "}
              <span className="font-bold tabular-nums text-slate-700">
                {filtered.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold tabular-nums text-slate-700">
                {rows.length}
              </span>{" "}
              permintaan
              {filter !== "SEMUA" && (
                <>
                  {" · "}
                  <span className="font-semibold text-slate-700">
                    {filter === "DISETUJUI" ? "Disetujui" : "Belum disetujui"}
                  </span>
                </>
              )}
              {(dateFrom || dateTo) && (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-slate-700">
                    {formatTanggal(dateFrom || null)} –{" "}
                    {formatTanggal(dateTo || null)}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Desktop: tabel */}
          {filtered.length === 0 ? (
            <EmptyState
              search={search}
              filter={filter}
              dateFilter={dateFrom !== "" || dateTo !== ""}
              onReset={resetFilter}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Permintaan
                      </th>
                      <th scope="col" className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Tanggal
                      </th>
                      <th scope="col" className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Departemen / Peminta
                      </th>
                      <th scope="col" className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Isi
                      </th>
                      <th scope="col" className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Prioritas
                      </th>
                      <th scope="col" className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((record) => {
                      const busy = busyId === record.id;
                      const selected = selectedId === record.id;
                      const summary = ringkasIsi(record);

                      return (
                        <tr
                          key={record.id}
                          className={`transition-colors ${
                            selected
                              ? "bg-sky-50/60"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(record.id)}
                              aria-expanded={selected}
                              aria-label={`Lihat detail ${record.noPermintaan}`}
                              className={`rounded font-mono text-[13px] font-bold text-[#1E3A5F] underline decoration-[#00A8E8]/40 decoration-2 underline-offset-4 transition hover:text-[#00A8E8] ${FOCUS}`}
                            >
                              {record.noPermintaan}
                            </button>
                            {record.kebutuhanUntuk && (
                              <p className="mt-0.5 max-w-[160px] truncate text-xs text-slate-400">
                                {record.kebutuhanUntuk}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                            {formatTanggal(record.tanggal)}
                          </td>

                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-700">
                              {record.departemen}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {record.namaPeminta}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                            <span className="font-semibold text-slate-700">
                              {summary.items} jenis
                            </span>{" "}
                            <span className="text-xs text-slate-400">
                              · {summary.pcs.toLocaleString("id-ID")} pcs
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityBadge(record.prioritas)}`}
                            >
                              {isUrgent(record.prioritas) && (
                                <FontAwesomeIcon
                                  icon={faTriangleExclamation}
                                  className="text-[10px]"
                                  aria-hidden="true"
                                />
                              )}
                              {record.prioritas}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${approvalBadge(record.approval)}`}
                            >
                              {approvalLabel(record.approval)}
                            </span>
                          </td>

                          <td className="px-5 py-3">
                            <RowActions
                              record={record}
                              busy={busy}
                              canApprove={canApprove}
                              isAdmin={isAdmin}
                              onSetujui={setujui}
                              onBatalkan={batalkan}
                              onHapus={hapus}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: daftar card ringkas */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {filtered.map((record) => {
                  const busy = busyId === record.id;
                  const selected = selectedId === record.id;
                  const summary = ringkasIsi(record);

                  return (
                    <li
                      key={record.id}
                      className={selected ? "bg-sky-50/60" : undefined}
                    >
                      <div className="flex items-start gap-2 px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(record.id)}
                          aria-expanded={selected}
                          aria-label={`Lihat detail ${record.noPermintaan}`}
                          className={`min-w-0 flex-1 rounded text-left ${FOCUS}`}
                        >
                          <span className="block truncate font-mono text-sm font-bold text-[#1E3A5F]">
                            {record.noPermintaan}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {record.departemen} · {record.namaPeminta}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityBadge(record.prioritas)}`}
                            >
                              {record.prioritas}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${approvalBadge(record.approval)}`}
                            >
                              {approvalLabel(record.approval)}
                            </span>
                            <span className="text-[11px] tabular-nums text-slate-400">
                              {summary.items} jenis ·{" "}
                              {summary.pcs.toLocaleString("id-ID")} pcs
                            </span>
                          </span>
                        </button>
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          aria-hidden="true"
                          className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-1 border-t border-dashed border-slate-100 px-4 py-1.5">
                        <RowActions
                          record={record}
                          busy={busy}
                          canApprove={canApprove}
                          isAdmin={isAdmin}
                          onSetujui={setujui}
                          onBatalkan={batalkan}
                          onHapus={hapus}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Skeleton saat loading awal */}
      {loading && (
        <section
          aria-label="Memuat data permintaan"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="space-y-2.5 px-4 py-4 sm:px-5">
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        </section>
      )}

      {/* Drawer detail */}
      {detail && (
        <DetailDrawer
          record={detail}
          busy={busyId === detail.id}
          canApprove={canApprove}
          isAdmin={isAdmin}
          onClose={closeDetail}
          onSetujui={(record) => setujui(record)}
          onBatalkan={(record) => void batalkan(record)}
          onHapus={(record) => void hapus(record)}
        />
      )}

      {keputusanFor && (
        <KeputusanApprovalModal
          record={keputusanFor}
          onClose={() => setKeputusanFor(null)}
          onDone={(message) => void selesaiSetujui(message)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row-level actions (dipakai tabel desktop + card mobile)             */
/* ------------------------------------------------------------------ */

function RowActions({
  record,
  busy,
  canApprove,
  isAdmin,
  onSetujui,
  onBatalkan,
  onHapus,
}: {
  record: PermintaanBarangRecord;
  busy: boolean;
  canApprove: boolean;
  isAdmin: boolean;
  onSetujui: (record: PermintaanBarangRecord) => void;
  onBatalkan: (record: PermintaanBarangRecord) => void;
  onHapus: (record: PermintaanBarangRecord) => void;
}) {
  const btn = `grid h-9 w-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;

  if (record.approval === "DISETUJUI") {
    if (!canApprove) return null;
    return (
      <div className="flex justify-end">
        <button
          type="button"
          aria-label={`Batalkan persetujuan ${record.noPermintaan}`}
          title="Batalkan persetujuan"
          disabled={busy}
          onClick={() => onBatalkan(record)}
          className={`${btn} text-[#1E3A5F] hover:bg-slate-100`}
        >
          <FontAwesomeIcon
            icon={busy ? faSpinner : faUndo}
            spin={busy}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }

  if (!canApprove && !isAdmin) return null;

  return (
    <div className="flex justify-end gap-1">
      {canApprove && (
        <button
          type="button"
          aria-label={`Setujui ${record.noPermintaan}`}
          title="Setujui permintaan"
          disabled={busy}
          onClick={() => onSetujui(record)}
          className={`${btn} text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700`}
        >
          <FontAwesomeIcon
            icon={busy ? faSpinner : faCheck}
            spin={busy}
            aria-hidden="true"
          />
        </button>
      )}
      {isAdmin && (
        <button
          type="button"
          aria-label={`Hapus ${record.noPermintaan}`}
          title="Hapus permintaan"
          disabled={busy}
          onClick={() => onHapus(record)}
          className={`${btn} text-slate-400 hover:bg-red-50 hover:text-red-600`}
        >
          <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty states                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  search,
  filter,
  dateFilter,
  onReset,
}: {
  search: string;
  filter: FilterStatus;
  dateFilter: boolean;
  onReset: () => void;
}) {
  const searching = search.trim() !== "";
  const filtering = filter !== "SEMUA" || dateFilter;

  const title = searching
    ? "Pencarian tidak menemukan hasil"
    : filtering
      ? "Tidak ada data pada filter ini"
      : "Belum ada permintaan";

  const desc = searching
    ? `Tidak ada permintaan yang cocok dengan "${search.trim()}". Coba kata kunci lain atau reset filter.`
    : filter !== "SEMUA"
      ? `Tidak ada permintaan berstatus "${filter === "DISETUJUI" ? "Disetujui" : "Belum disetujui"}".`
      : dateFilter
        ? "Tidak ada permintaan pada rentang tanggal yang dipilih."
        : "Belum ada permintaan barang yang tercatat. Data baru dari form publik akan muncul di sini.";

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400"
      >
        <FontAwesomeIcon icon={searching ? faMagnifyingGlass : faClipboardList} />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-700">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{desc}</p>
      {(searching || filtering) && (
        <button
          type="button"
          onClick={onReset}
          className={`mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-[#1E3A5F] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#16304F] ${FOCUS}`}
        >
          Reset filter
        </button>
      )}
    </div>
  );
}
