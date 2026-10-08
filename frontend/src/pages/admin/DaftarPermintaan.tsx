import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faTrash,
  faMagnifyingGlass,
  faUndo,
  faClipboardList,
  faClock,
  faCircleCheck,
  faTriangleExclamation,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";

import {
  listPermintaan,
  setApprovalPermintaan,
  deletePermintaan,
  type ApprovalPermintaan,
  type PermintaanBarangRecord,
} from "../../api/permintaanBarang";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 " +
  "placeholder:text-slate-400 outline-none transition " +
  "focus:border-[#00A8E8] focus:ring-4 focus:ring-[#00A8E8]/10";

type FilterStatus = "SEMUA" | ApprovalPermintaan;

const approvalBadge = (status: ApprovalPermintaan) => {
  if (status === "DISETUJUI") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
  }

  return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20";
};

const approvalLabel = (status: ApprovalPermintaan) => {
  return status === "DISETUJUI" ? "Disetujui" : "Belum disetujui";
};

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

export default function DaftarPermintaan() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("SEMUA");

  const [rows, setRows] = useState<PermintaanBarangRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const flash = useCallback((message: string) => {
    setNotice(message);

    window.setTimeout(() => {
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
    [],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const changeFilter = (status: FilterStatus) => {
    setFilter(status);
    setExpanded(null);
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

    const urgent = rows.filter(
      (row) => row.prioritas === "Urgent",
    ).length;

    return {
      total: rows.length,
      belumDisetujui,
      disetujui,
      urgent,
    };
  }, [rows]);

  const setujui = async (record: PermintaanBarangRecord) => {
    if (
      !window.confirm(
        `Setujui permintaan ${record.noPermintaan}?\n\nData akan terkunci setelah disetujui.`,
      )
    ) {
      return;
    }

    setBusyId(record.id);

    try {
      await setApprovalPermintaan(record.id, "DISETUJUI");

      flash(`Permintaan ${record.noPermintaan} berhasil disetujui.`);

      await load(filter);
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Gagal menyetujui permintaan.",
      );
    } finally {
      setBusyId(null);
    }
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
        e instanceof Error
          ? e.message
          : "Gagal membatalkan persetujuan.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const hapus = async (record: PermintaanBarangRecord) => {
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

      if (expanded === record.id) {
        setExpanded(null);
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
    setExpanded((current) => (current === id ? null : id));
  };

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* =========================================================
          HEADER
      ========================================================== */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-lg bg-[#00A8E8]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#008CC2]">
              Warehouse
            </span>

            <span className="text-xs text-slate-400">/</span>

            <span className="text-xs font-medium text-slate-500">
              Permintaan Barang
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#1E3A5F] sm:text-4xl">
            Daftar Permintaan
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
            Kelola permintaan barang dari setiap departemen. Tinjau detail,
            setujui permintaan, atau hapus permintaan yang belum diperlukan.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void load(filter, true)}
          className="
            inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200
            bg-white px-4 py-2.5 text-sm font-semibold text-slate-600
            shadow-sm transition hover:border-[#00A8E8]/30 hover:bg-slate-50
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <FontAwesomeIcon
            icon={faRotate}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </header>

      {/* =========================================================
          NOTIFICATION
      ========================================================== */}
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            role="alert"
            className="
              flex items-start gap-3 rounded-xl border border-red-200
              bg-red-50 px-4 py-3.5 text-sm text-red-700
            "
          >
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="mt-0.5"
            />

            <div>
              <p className="font-semibold">Gagal memuat data</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="
              flex items-start gap-3 rounded-xl border border-emerald-200
              bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700
            "
          >
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="mt-0.5"
            />

            <p className="font-medium">{notice}</p>
          </div>
        )}
      </div>

      {/* =========================================================
          STATISTICS
      ========================================================== */}
      {!loading && !error && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Permintaan
                  </p>

                  <p className="mt-2 text-3xl font-bold tabular-nums text-[#1E3A5F]">
                    {statistics.total.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A8E8]">
                  <FontAwesomeIcon icon={faClipboardList} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Data sesuai filter saat ini
              </p>
            </div>

            {/* Pending */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Belum Disetujui
                  </p>

                  <p className="mt-2 text-3xl font-bold tabular-nums text-amber-600">
                    {statistics.belumDisetujui.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FontAwesomeIcon icon={faClock} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Menunggu pemeriksaan
              </p>
            </div>

            {/* Approved */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Disetujui
                  </p>

                  <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">
                    {statistics.disetujui.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FontAwesomeIcon icon={faCircleCheck} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Permintaan yang terkunci
              </p>
            </div>

            {/* Urgent */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Prioritas Urgent
                  </p>

                  <p className="mt-2 text-3xl font-bold tabular-nums text-red-600">
                    {statistics.urgent.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Membutuhkan perhatian
              </p>
            </div>
          </section>

          {/* =========================================================
              FILTER
          ========================================================== */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex-1">
                <label
                  htmlFor="permintaan-search"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Cari permintaan
                </label>

                <div className="relative max-w-xl">
                  <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="
                      pointer-events-none absolute left-4 top-1/2
                      h-4 w-4 -translate-y-1/2 text-slate-400
                    "
                  />

                  <input
                    id="permintaan-search"
                    type="search"
                    className={`${inputCls} pl-11`}
                    placeholder="Nomor permintaan, nama peminta, atau departemen..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="
                        absolute right-3 top-1/2 -translate-y-1/2
                        rounded-md px-2 py-1 text-xs font-medium
                        text-slate-400 hover:bg-slate-100 hover:text-slate-600
                      "
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full xl:w-64">
                <label
                  htmlFor="permintaan-filter"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Status Approval
                </label>

                <select
                  id="permintaan-filter"
                  className={inputCls}
                  value={filter}
                  onChange={(event) =>
                    changeFilter(event.target.value as FilterStatus)
                  }
                >
                  <option value="SEMUA">Semua status</option>
                  <option value="BELUM_DISETUJUI">
                    Belum disetujui
                  </option>
                  <option value="DISETUJUI">Disetujui</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Menampilkan{" "}
                <span className="font-semibold text-slate-700">
                  {filtered.length}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-slate-700">
                  {rows.length}
                </span>{" "}
                permintaan
              </p>

              {search && (
                <p>
                  Hasil pencarian untuk{" "}
                  <span className="font-semibold text-slate-700">
                    "{search}"
                  </span>
                </p>
              )}
            </div>
          </section>

          {/* =========================================================
              TABLE
          ========================================================== */}
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-bold text-[#1E3A5F]">
                  Data Permintaan
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Klik nomor permintaan untuk melihat detail
                </p>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FontAwesomeIcon
                    icon={faClipboardList}
                    className="text-xl"
                  />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-700">
                  Tidak ada permintaan
                </h3>

                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                  Tidak ditemukan data yang sesuai dengan pencarian atau
                  filter yang dipilih.
                </p>

                {(search || filter !== "SEMUA") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      changeFilter("SEMUA");
                    }}
                    className="
                      mt-4 rounded-lg bg-[#1E3A5F] px-4 py-2
                      text-xs font-semibold text-white transition
                      hover:bg-[#16304F]
                    "
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="w-[180px] px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Permintaan
                      </th>

                      <th className="w-[120px] px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Tanggal
                      </th>

                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Departemen / Peminta
                      </th>

                      <th className="w-[150px] px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Isi
                      </th>

                      <th className="w-[120px] px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Prioritas
                      </th>

                      <th className="w-[150px] px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="w-[130px] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Aksi
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((record) => {
                      const open = expanded === record.id;
                      const busy = busyId === record.id;
                      const summary = ringkasIsi(record);

                      return (
                        <Fragment key={record.id}>
                          {/* =================================================
                              MAIN ROW
                          ================================================== */}
                          <tr
                            className={`
                              group text-sm transition
                              ${
                                open
                                  ? "bg-slate-50"
                                  : "hover:bg-slate-50/70"
                              }
                            `}
                          >
                            <td className="px-6 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleExpanded(record.id)
                                }
                                className="
                                  group/id inline-flex items-center gap-2
                                  text-left font-mono text-sm font-bold
                                  text-[#1E3A5F] hover:text-[#00A8E8]
                                "
                                aria-expanded={open}
                              >
                                <span>{record.noPermintaan}</span>

                                <FontAwesomeIcon
                                  icon={faChevronDown}
                                  className={`
                                    h-3 w-3 text-slate-400 transition-transform
                                    ${
                                      open
                                        ? "rotate-180 text-[#00A8E8]"
                                        : "group-hover/id:text-[#00A8E8]"
                                    }
                                  `}
                                />
                              </button>

                              {record.kebutuhanUntuk && (
                                <p className="mt-1 max-w-[170px] truncate text-xs text-slate-400">
                                  {record.kebutuhanUntuk}
                                </p>
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                              {formatTanggal(record.tanggal)}
                            </td>

                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-700">
                                {record.departemen}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {record.namaPeminta}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold tabular-nums text-slate-700">
                                  {summary.items} barang
                                </span>

                                <span className="mt-0.5 text-xs tabular-nums text-slate-400">
                                  {summary.pcs.toLocaleString("id-ID")} pcs
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`
                                  inline-flex items-center gap-1.5 rounded-full
                                  px-2.5 py-1 text-[11px] font-bold
                                  ${
                                    record.prioritas === "Urgent"
                                      ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                                      : "bg-slate-100 text-slate-600"
                                  }
                                `}
                              >
                                {record.prioritas === "Urgent" && (
                                  <FontAwesomeIcon
                                    icon={faTriangleExclamation}
                                    className="text-[10px]"
                                  />
                                )}

                                {record.prioritas}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`
                                  inline-flex items-center rounded-full
                                  px-2.5 py-1 text-[11px] font-bold
                                  ${approvalBadge(record.approval)}
                                `}
                              >
                                {approvalLabel(record.approval)}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-1">
                                {record.approval ===
                                "BELUM_DISETUJUI" ? (
                                  <>
                                    <button
                                      type="button"
                                      aria-label={`Setujui ${record.noPermintaan}`}
                                      title="Setujui permintaan"
                                      disabled={busy}
                                      onClick={() =>
                                        void setujui(record)
                                      }
                                      className="
                                        flex h-9 w-9 items-center justify-center
                                        rounded-lg text-emerald-600 transition
                                        hover:bg-emerald-50 hover:text-emerald-700
                                        disabled:cursor-not-allowed disabled:opacity-40
                                      "
                                    >
                                      <FontAwesomeIcon
                                        icon={faCheck}
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      aria-label={`Hapus ${record.noPermintaan}`}
                                      title="Hapus permintaan"
                                      disabled={busy}
                                      onClick={() =>
                                        void hapus(record)
                                      }
                                      className="
                                        flex h-9 w-9 items-center justify-center
                                        rounded-lg text-slate-400 transition
                                        hover:bg-red-50 hover:text-red-600
                                        disabled:cursor-not-allowed disabled:opacity-40
                                      "
                                    >
                                      <FontAwesomeIcon
                                        icon={faTrash}
                                      />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Batalkan persetujuan ${record.noPermintaan}`}
                                    title="Batalkan persetujuan"
                                    disabled={busy}
                                    onClick={() =>
                                      void batalkan(record)
                                    }
                                    className="
                                      flex h-9 w-9 items-center justify-center
                                      rounded-lg text-[#1E3A5F] transition
                                      hover:bg-[#1E3A5F]/5
                                      disabled:cursor-not-allowed disabled:opacity-40
                                    "
                                  >
                                    <FontAwesomeIcon icon={faUndo} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* =================================================
                              DETAIL ROW
                          ================================================== */}
                          {open && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="px-6 pb-6 pt-1">
                                <div className="rounded-xl border border-slate-200 bg-white p-5">
                                  {/* Detail Header */}
                                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Detail Permintaan
                                      </p>

                                      <h3 className="mt-1 font-mono text-base font-bold text-[#1E3A5F]">
                                        {record.noPermintaan}
                                      </h3>
                                    </div>

                                    <span
                                      className={`
                                        w-fit rounded-full px-3 py-1 text-xs font-bold
                                        ${approvalBadge(record.approval)}
                                      `}
                                    >
                                      {approvalLabel(record.approval)}
                                    </span>
                                  </div>

                                  {/* Metadata */}
                                  <div className="grid gap-x-8 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Departemen
                                      </p>

                                      <p className="mt-1 text-sm font-medium text-slate-700">
                                        {record.departemen}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Peminta
                                      </p>

                                      <p className="mt-1 text-sm font-medium text-slate-700">
                                        {record.namaPeminta}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Dibutuhkan
                                      </p>

                                      <p className="mt-1 text-sm font-medium text-slate-700">
                                        {formatTanggalLengkap(
                                          record.tanggalDibutuhkan,
                                        )}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Kebutuhan
                                      </p>

                                      <p className="mt-1 text-sm font-medium text-slate-700">
                                        {record.kebutuhanUntuk}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Reason */}
                                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                      Alasan / Keterangan
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-700">
                                      {record.alasan || "-"}
                                    </p>
                                  </div>

                                  {/* Items */}
                                  <div className="mt-5">
                                    <div className="mb-3 flex items-center justify-between">
                                      <div>
                                        <h4 className="text-sm font-bold text-[#1E3A5F]">
                                          Daftar Barang
                                        </h4>

                                        <p className="mt-0.5 text-xs text-slate-400">
                                          {summary.items} jenis barang ·{" "}
                                          {summary.pcs.toLocaleString(
                                            "id-ID",
                                          )}{" "}
                                          pcs
                                        </p>
                                      </div>
                                    </div>

                                    <div className="overflow-hidden rounded-lg border border-slate-200">
                                      <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50">
                                          <tr>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                              Barang
                                            </th>

                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                              Spesifikasi
                                            </th>

                                            <th className="w-32 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                              Jumlah
                                            </th>
                                          </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {record.items.map((item) => (
                                            <tr key={item.id}>
                                              <td className="px-4 py-3 font-medium text-slate-700">
                                                {item.nama}
                                              </td>

                                              <td className="px-4 py-3 text-slate-500">
                                                {item.spesifikasi || "-"}
                                              </td>

                                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">
                                                {item.jumlah.toLocaleString(
                                                  "id-ID",
                                                )}{" "}
                                                {item.satuan || ""}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Detail Actions */}
                                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                                    {record.approval ===
                                    "BELUM_DISETUJUI" ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            void hapus(record)
                                          }
                                          className="
                                            inline-flex items-center justify-center gap-2
                                            rounded-lg border border-red-200 bg-white
                                            px-4 py-2.5 text-xs font-bold text-red-600
                                            transition hover:bg-red-50
                                            disabled:cursor-not-allowed disabled:opacity-40
                                          "
                                        >
                                          <FontAwesomeIcon icon={faTrash} />
                                          Hapus
                                        </button>

                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            void setujui(record)
                                          }
                                          className="
                                            inline-flex items-center justify-center gap-2
                                            rounded-lg bg-emerald-600 px-4 py-2.5
                                            text-xs font-bold text-white transition
                                            hover:bg-emerald-700
                                            disabled:cursor-not-allowed disabled:opacity-40
                                          "
                                        >
                                          <FontAwesomeIcon icon={faCheck} />
                                          Setujui Permintaan
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          void batalkan(record)
                                        }
                                        className="
                                          inline-flex items-center justify-center gap-2
                                          rounded-lg border border-slate-200 bg-white
                                          px-4 py-2.5 text-xs font-bold text-[#1E3A5F]
                                          transition hover:bg-slate-50
                                          disabled:cursor-not-allowed disabled:opacity-40
                                        "
                                      >
                                        <FontAwesomeIcon icon={faUndo} />
                                        Batalkan Persetujuan
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =========================================================
          LOADING STATE
      ========================================================== */}
      {loading && (
        <section className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="space-y-4">
            <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />

            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />

            <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />

            <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />

            <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        </section>
      )}
    </div>
  );
}