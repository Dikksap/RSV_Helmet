import { useCallback, useEffect, useMemo, useState } from "react";
import { getDivisi } from "../../api/divisi";
import {
  createPemakaianMaterial,
  deletePemakaianMaterial,
  getStokDivisi,
  listPemakaianMaterial,
  updatePemakaianMaterial,
  type CreatePemakaianPayload,
  type PemakaianMaterialRecord,
  type StokDivisiRecord,
} from "../../api/pemakaianMaterial";
import { listPermintaan } from "../../api/permintaanBarang";
import { downloadCsv } from "../../lib/csv";
import type { Divisi } from "../../api/divisi";
import type { PermintaanBarangRecord } from "../../api/permintaanBarang";
import {
  PemakaianHeader,
  PemakaianStats,
  PemakaianFilter,
  PemakaianTable,
  StokDivisiBoard,
  ModalCatatPemakaian,
  ModalDetailPemakaian,
  ModalHapusPemakaian,
  type ActiveTab,
  type ModalDeleteState,
  type ModalDetailState,
  type ModalFormItemState,
  type ModalFormState,
  type PemakaianFilterState,
  type PemakaianPaginationState,
  type SummaryStatItem,
} from "../../components/admin/PemakaianMaterial";

const INITIAL_PAGINATION: PemakaianPaginationState = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const INITIAL_FILTERS: PemakaianFilterState = {
  search: "",
  divisiId: "",
  dateFrom: "",
  dateTo: "",
};

const INITIAL_MODAL_FORM: ModalFormState = {
  open: false,
  mode: "create",
  editId: null,
  divisiId: "",
  permintaanId: "",
  tanggal: new Date().toISOString().slice(0, 10),
  keterangan: "",
  busy: false,
  error: null,
  items: {},
};

export default function PemakaianMaterial() {
  const [rows, setRows] = useState<PemakaianMaterialRecord[]>([]);
  const [divisis, setDivisis] = useState<Divisi[]>([]);
  const [permintaans, setPermintaans] = useState<PermintaanBarangRecord[]>([]);
  const [stokDivisi, setStokDivisi] = useState<StokDivisiRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("stok");
  const [stokPeriode, setStokPeriode] = useState({ dari: "", sampai: "" });
  const [filters, setFilters] = useState<PemakaianFilterState>(INITIAL_FILTERS);
  const [pagination, setPagination] = useState<PemakaianPaginationState>(INITIAL_PAGINATION);

  const [modalForm, setModalForm] = useState<ModalFormState>(INITIAL_MODAL_FORM);
  const [modalDetail, setModalDetail] = useState<ModalDetailState>({
    open: false,
    record: null,
  });
  const [modalDelete, setModalDelete] = useState<ModalDeleteState>({
    open: false,
    record: null,
    busy: false,
    error: null,
  });

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // Fetch all required data
  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [permintaanResponse, divisiResponse, pemakaianData, stokData] =
          await Promise.all([
            listPermintaan({ page: 1, limit: 100, approval: "DISETUJUI" }),
            getDivisi(),
            listPemakaianMaterial({
              page: pagination.page,
              limit: pagination.limit,
              divisiId: filters.divisiId ? Number(filters.divisiId) : undefined,
              dari: filters.dateFrom || undefined,
              sampai: filters.dateTo || undefined,
            }),
            getStokDivisi({
              dari: stokPeriode.dari || undefined,
              sampai: stokPeriode.sampai || undefined,
            }),
          ]);

        setPermintaans(permintaanResponse.data);
        setDivisis(divisiResponse);
        setRows(pemakaianData.data);
        setStokDivisi(stokData);
        setPagination((prev) => ({
          ...prev,
          total: pemakaianData.meta.total,
          totalPages: pemakaianData.meta.totalPages,
        }));
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat data pemakaian material."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters.dateFrom, filters.dateTo, filters.divisiId, pagination.page, pagination.limit, stokPeriode.dari, stokPeriode.sampai]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Client-side instant filter for search text (nomor dokumen, nama divisi, permintaan)
  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const matchNomor = row.nomor.toLowerCase().includes(q);
      const matchDivisi = row.divisi?.nama.toLowerCase().includes(q);
      const matchPermintaan = row.permintaan?.noPermintaan
        .toLowerCase()
        .includes(q);
      const matchPeminta = row.permintaan?.namaPeminta
        .toLowerCase()
        .includes(q);
      return matchNomor || matchDivisi || matchPermintaan || matchPeminta;
    });
  }, [rows, filters.search]);

  // Build stock balance lookup: Map<divisiId, Map<materialKey, sisa>>
  const stokDivisiLookup = useMemo(() => {
    const map = new Map<number, Map<string, number>>();
    for (const group of stokDivisi) {
      const matMap = new Map<string, number>();
      for (const m of group.materials) {
        matMap.set(m.key, m.sisa);
        if (m.itemId !== null) {
          matMap.set(`item:${m.itemId}`, m.sisa);
        }
        matMap.set(`name:${m.nama.trim().toLowerCase()}`, m.sisa);
      }
      map.set(group.divisiId, matMap);
    }
    return map;
  }, [stokDivisi]);

  // Helper to resolve stock before for an item in a division
  const resolveStockBefore = useCallback(
    (
      divisiId: number,
      item: {
        itemId: number | null;
        nama: string;
        jumlahDisetujui?: number | null;
        jumlah?: number;
      }
    ): number => {
      const divMap = stokDivisiLookup.get(divisiId);
      if (divMap) {
        if (item.itemId !== null && divMap.has(`item:${item.itemId}`)) {
          return divMap.get(`item:${item.itemId}`) ?? 0;
        }
        const nameKey = `name:${item.nama.trim().toLowerCase()}`;
        if (divMap.has(nameKey)) {
          return divMap.get(nameKey) ?? 0;
        }
      }
      return item.jumlahDisetujui ?? item.jumlah ?? 0;
    },
    [stokDivisiLookup]
  );

  // Summary Metrics
  const summaryStats: SummaryStatItem[] = useMemo(() => {
    const distinctDivisi = new Set(
      rows.map((r) => r.divisiId).filter(Boolean)
    ).size;
    const totalMaterialsRecorded = rows.reduce(
      (sum, r) => sum + (r.items?.length || 0),
      0
    );
    const totalSisaStok = stokDivisi.reduce(
      (sum, g) => sum + g.materials.reduce((mSum, m) => mSum + m.sisa, 0),
      0
    );

    return [
      {
        label: "Total Transaksi",
        value: pagination.total,
        hint: "Dokumen pemakaian tercatat",
        accent: "#00A8E8",
        iconType: "record",
      },
      {
        label: "Divisi Aktif",
        value: distinctDivisi,
        hint: "Divisi yang telah mencatat",
        accent: "#2563EB",
        iconType: "divisi",
      },
      {
        label: "Material Digunakan",
        value: totalMaterialsRecorded,
        hint: "Akumulasi item material",
        accent: "#0F766E",
        iconType: "material",
      },
      {
        label: "Total Sisa Stok",
        value: totalSisaStok.toLocaleString("id-ID", {
          maximumFractionDigits: 2,
        }),
        hint: "Saldo fisik di seluruh divisi",
        accent: "#6366F1",
        iconType: "sisa",
      },
    ];
  }, [pagination.total, rows, stokDivisi]);

  // Handle open Create Modal
  const handleOpenCreate = useCallback(
    (preselectedDivisiId?: number) => {
      const defaultDivisiId = preselectedDivisiId
        ? String(preselectedDivisiId)
        : divisis.length > 0
        ? String(divisis[0].id)
        : "";

      // Check if there are matching approved permintaans for default division
      const selectedDivisiObj = divisis.find(
        (d) => String(d.id) === defaultDivisiId
      );
      const matching = selectedDivisiObj
        ? permintaans.filter(
            (p) =>
              p.approval === "DISETUJUI" &&
              p.departemen.trim().toLowerCase() ===
                selectedDivisiObj.nama.trim().toLowerCase()
          )
        : [];

      const initialPermintaanId = matching.length > 0 ? String(matching[0].id) : "";

      // Initialize items if permintaan is automatically selected
      const initialItems: Record<number, ModalFormItemState> = {};
      if (initialPermintaanId && defaultDivisiId) {
        const primary = matching.find((p) => String(p.id) === initialPermintaanId);
        if (primary) {
          for (const itm of primary.items ?? []) {
            if (itm.statusKeputusan !== "DISETUJUI") continue;
            const stokSebelum = resolveStockBefore(Number(defaultDivisiId), itm);
            initialItems[itm.id] = {
              permintaanBarangItemId: itm.id,
              itemId: itm.itemId ?? null,
              nama: itm.nama,
              satuan: itm.satuan ?? itm.item?.unit ?? "",
              stokSebelum,
              sisaFisik: String(stokSebelum),
              used: true,
              keteranganSisa: "",
            };
          }
        }
      }

      setModalForm({
        open: true,
        mode: "create",
        editId: null,
        divisiId: defaultDivisiId,
        permintaanId: initialPermintaanId,
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: "",
        busy: false,
        error: null,
        items: initialItems,
      });
    },
    [divisis, permintaans, resolveStockBefore]
  );

  // Handle Division change in modal
  const handleChangeModalDivisi = useCallback(
    (divisiId: string) => {
      const selectedDivisiObj = divisis.find((d) => String(d.id) === divisiId);
      const matching = selectedDivisiObj
        ? permintaans.filter(
            (p) =>
              p.approval === "DISETUJUI" &&
              p.departemen.trim().toLowerCase() ===
                selectedDivisiObj.nama.trim().toLowerCase()
          )
        : [];

      const autoPermintaanId = matching.length === 1 ? String(matching[0].id) : "";
      const nextItems: Record<number, ModalFormItemState> = {};

      if (autoPermintaanId && divisiId) {
        const primary = matching[0];
        for (const itm of primary.items ?? []) {
          if (itm.statusKeputusan !== "DISETUJUI") continue;
          const stokSebelum = resolveStockBefore(Number(divisiId), itm);
          nextItems[itm.id] = {
            permintaanBarangItemId: itm.id,
            itemId: itm.itemId ?? null,
            nama: itm.nama,
            satuan: itm.satuan ?? itm.item?.unit ?? "",
            stokSebelum,
            sisaFisik: String(stokSebelum),
            used: true,
            keteranganSisa: "",
          };
        }
      }

      setModalForm((prev) => ({
        ...prev,
        divisiId,
        permintaanId: autoPermintaanId,
        items: nextItems,
        error: null,
      }));
    },
    [divisis, permintaans, resolveStockBefore]
  );

  // Handle Permintaan change in modal
  const handleChangeModalPermintaan = useCallback(
    (permintaanId: string) => {
      const primary = permintaans.find((p) => String(p.id) === permintaanId);
      const nextItems: Record<number, ModalFormItemState> = {};

      if (primary && modalForm.divisiId) {
        for (const itm of primary.items ?? []) {
          if (itm.statusKeputusan !== "DISETUJUI") continue;
          const stokSebelum = resolveStockBefore(
            Number(modalForm.divisiId),
            itm
          );
          nextItems[itm.id] = {
            permintaanBarangItemId: itm.id,
            itemId: itm.itemId ?? null,
            nama: itm.nama,
            satuan: itm.satuan ?? itm.item?.unit ?? "",
            stokSebelum,
            sisaFisik: String(stokSebelum),
            used: true,
            keteranganSisa: "",
          };
        }
      }

      setModalForm((prev) => ({
        ...prev,
        permintaanId,
        items: nextItems,
        error: null,
      }));
    },
    [permintaans, modalForm.divisiId, resolveStockBefore]
  );

  // Open Edit Modal
  const handleOpenEdit = useCallback((row: PemakaianMaterialRecord) => {
    const editItems: Record<number, ModalFormItemState> = {};
    for (const item of row.items ?? []) {
      editItems[item.permintaanBarangItemId] = {
        permintaanBarangItemId: item.permintaanBarangItemId,
        itemId: item.itemId ?? null,
        nama:
          item.permintaanItem?.nama ??
          item.item?.nama ??
          item.item?.kode ??
          "Material",
        satuan: item.satuan ?? item.item?.unit ?? "",
        stokSebelum: Number(item.jumlahDiterima) || 0,
        sisaFisik: String(item.jumlahSisa),
        used: true,
        keteranganSisa: item.keteranganSisa || "",
      };
    }

    setModalForm({
      open: true,
      mode: "edit",
      editId: row.id,
      divisiId: String(row.divisiId),
      permintaanId: String(row.permintaanId),
      tanggal: row.tanggal
        ? new Date(row.tanggal).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      keterangan: row.keterangan || "",
      busy: false,
      error: null,
      items: editItems,
    });
  }, []);

  // Submit Modal Form (Create or Edit)
  const handleSubmitModalForm = async () => {
    setModalForm((prev) => ({ ...prev, busy: true, error: null }));

    try {
      const selectedItems = Object.values(modalForm.items).filter(
        (item) => item.used
      );
      if (selectedItems.length === 0) {
        throw new Error("Pilih minimal satu material dengan nilai pemakaian");
      }

      const payloadItems = selectedItems.map((item) => {
        const sisaNum = Number(item.sisaFisik.replace(",", "."));
        if (!Number.isFinite(sisaNum) || sisaNum < 0) {
          throw new Error(
            `Nilai sisa untuk "${item.nama}" tidak valid atau bernilai negatif`
          );
        }
        if (sisaNum > item.stokSebelum) {
          throw new Error(
            `Nilai sisa untuk "${item.nama}" tidak boleh melebihi stok sebelumnya (${item.stokSebelum})`
          );
        }
        return {
          permintaanBarangItemId: item.permintaanBarangItemId,
          jumlahSisa: sisaNum,
          satuan: item.satuan || null,
          keteranganSisa: item.keteranganSisa.trim() || null,
        };
      });

      const payload: CreatePemakaianPayload = {
        permintaanId: Number(modalForm.permintaanId),
        divisiId: Number(modalForm.divisiId),
        tanggal: modalForm.tanggal || null,
        keterangan: modalForm.keterangan.trim() || null,
        items: payloadItems,
      };

      if (modalForm.mode === "edit" && modalForm.editId) {
        await updatePemakaianMaterial(modalForm.editId, payload);
        flash("Perubahan pemakaian material berhasil disimpan.");
      } else {
        await createPemakaianMaterial(payload);
        flash("Pemakaian material baru berhasil dicatat.");
      }

      setModalForm((prev) => ({ ...prev, open: false, busy: false }));
      await load();
    } catch (err) {
      setModalForm((prev) => ({
        ...prev,
        busy: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan pemakaian material.",
      }));
    }
  };

  // Open Delete Modal
  const handleOpenDelete = useCallback((row: PemakaianMaterialRecord) => {
    setModalDelete({
      open: true,
      record: row,
      busy: false,
      error: null,
    });
  }, []);

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!modalDelete.record) return;
    setModalDelete((prev) => ({ ...prev, busy: true, error: null }));

    try {
      await deletePemakaianMaterial(modalDelete.record.id);
      setModalDelete({ open: false, record: null, busy: false, error: null });
      flash(`Transaksi pemakaian ${modalDelete.record.nomor} berhasil dihapus.`);
      await load();
    } catch (err) {
      setModalDelete((prev) => ({
        ...prev,
        busy: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus transaksi pemakaian.",
      }));
    }
  };

  // Export CSV
  const handleExportCsv = useCallback(
    (mode: "ringkas" | "rincian") => {
      const formatDate = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
      };

      if (mode === "ringkas") {
        const headers = [
          "No. Dokumen",
          "Tanggal",
          "Divisi",
          "No. Permintaan",
          "Peminta",
          "Jumlah Jenis Item",
          "Catatan",
          "Petugas Pencatat",
        ];
        const dataRows = rows.map((r) => [
          r.nomor,
          formatDate(r.tanggal),
          r.divisi?.nama ?? "",
          r.permintaan?.noPermintaan ?? "",
          r.permintaan?.namaPeminta ?? "",
          r.items?.length ?? 0,
          r.keterangan ?? "",
          r.user?.name ?? "",
        ]);
        downloadCsv(`pemakaian_material_ringkas_${new Date().toISOString().slice(0, 10)}.csv`, [
          headers,
          ...dataRows,
        ]);
      } else {
        const headers = [
          "No. Dokumen",
          "Tanggal",
          "Divisi",
          "No. Permintaan",
          "Nama Material",
          "Stok Awal",
          "Jumlah Dipakai",
          "Sisa Akhir",
          "Satuan",
          "Catatan Sisa",
          "Petugas",
        ];
        const dataRows = rows.flatMap((r) =>
          r.items.map((item) => [
            r.nomor,
            formatDate(r.tanggal),
            r.divisi?.nama ?? "",
            r.permintaan?.noPermintaan ?? "",
            item.permintaanItem?.nama ?? item.item?.nama ?? "Material",
            item.jumlahDiterima,
            item.jumlahDipakai,
            item.jumlahSisa,
            item.satuan ?? item.item?.unit ?? "",
            item.keteranganSisa ?? "",
            r.user?.name ?? "",
          ])
        );
        downloadCsv(`pemakaian_material_rincian_${new Date().toISOString().slice(0, 10)}.csv`, [
          headers,
          ...dataRows,
        ]);
      }
    },
    [rows]
  );

  const isFiltered = Boolean(
    filters.search || filters.divisiId || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="min-h-full space-y-6 bg-slate-50/60 pb-12">
      {/* Header */}
      <PemakaianHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCreate={() => handleOpenCreate()}
        onRefresh={() => void load(true)}
        refreshing={refreshing}
        onExportCsv={handleExportCsv}
        hasData={rows.length > 0}
      />

      {/* KPI Stats */}
      <PemakaianStats stats={summaryStats} />

      {/* Alerts */}
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load(true)}
              className="rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            {notice}
          </div>
        )}
      </div>

      {/* Tab 1: Riwayat Transaksi Pemakaian */}
      {activeTab === "riwayat" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <PemakaianFilter
            filters={filters}
            onChange={(nextFilters) => {
              setFilters(nextFilters);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            divisis={divisis}
            onReset={() => {
              setFilters(INITIAL_FILTERS);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            isFiltered={isFiltered}
          />

          {/* Table */}
          <PemakaianTable
            rows={filteredRows}
            loading={loading}
            pagination={pagination}
            onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
            onLimitChange={(limit) =>
              setPagination((p) => ({ ...p, limit, page: 1 }))
            }
            onViewDetail={(row) => setModalDetail({ open: true, record: row })}
            onEdit={handleOpenEdit}
            onDelete={handleOpenDelete}
            onOpenCreate={() => handleOpenCreate()}
          />
        </div>
      )}

      {/* Tab 2: Monitoring Saldo Stok per Divisi */}
      {activeTab === "stok" && (
        <StokDivisiBoard
          stokDivisi={stokDivisi}
          periode={stokPeriode}
          onPeriodeChange={setStokPeriode}
          onRecordPemakaianForDivisi={(divisiId) => handleOpenCreate(divisiId)}
        />
      )}

      {/* Modal: Catat / Edit Pemakaian */}
      {modalForm.open && (
        <ModalCatatPemakaian
          state={modalForm}
          divisis={divisis}
          permintaans={permintaans}
          onClose={() => setModalForm((prev) => ({ ...prev, open: false }))}
          onChangeDivisi={handleChangeModalDivisi}
          onChangePermintaan={handleChangeModalPermintaan}
          onUpdateField={(field, val) =>
            setModalForm((prev) => ({ ...prev, [field]: val }))
          }
          onToggleItem={(itemId, used) =>
            setModalForm((prev) => ({
              ...prev,
              items: {
                ...prev.items,
                [itemId]: { ...prev.items[itemId], used },
              },
            }))
          }
          onChangeItemSisa={(itemId, sisa) =>
            setModalForm((prev) => ({
              ...prev,
              items: {
                ...prev.items,
                [itemId]: { ...prev.items[itemId], sisaFisik: sisa },
              },
            }))
          }
          onChangeItemKeterangan={(itemId, ket) =>
            setModalForm((prev) => ({
              ...prev,
              items: {
                ...prev.items,
                [itemId]: { ...prev.items[itemId], keteranganSisa: ket },
              },
            }))
          }
          onSetQuickSisa={(itemId, type) =>
            setModalForm((prev) => {
              const cur = prev.items[itemId];
              if (!cur) return prev;
              const nextSisa = type === "habis" ? "0" : String(cur.stokSebelum);
              return {
                ...prev,
                items: {
                  ...prev.items,
                  [itemId]: { ...cur, sisaFisik: nextSisa },
                },
              };
            })
          }
          onSetAllQuick={(type) =>
            setModalForm((prev) => {
              const nextItems: Record<number, ModalFormItemState> = {};
              for (const [k, itm] of Object.entries(prev.items)) {
                const id = Number(k);
                nextItems[id] = {
                  ...itm,
                  sisaFisik: type === "habis" ? "0" : String(itm.stokSebelum),
                };
              }
              return { ...prev, items: nextItems };
            })
          }
          onSubmit={() => void handleSubmitModalForm()}
        />
      )}

      {/* Modal: Detail Pemakaian */}
      {modalDetail.open && (
        <ModalDetailPemakaian
          record={modalDetail.record}
          onClose={() => setModalDetail({ open: false, record: null })}
        />
      )}

      {/* Modal: Hapus Pemakaian */}
      {modalDelete.open && (
        <ModalHapusPemakaian
          state={modalDelete}
          onClose={() =>
            setModalDelete({ open: false, record: null, busy: false, error: null })
          }
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}
