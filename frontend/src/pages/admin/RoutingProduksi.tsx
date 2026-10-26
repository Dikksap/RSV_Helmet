import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faArrowsRotate,
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCircleNodes,
  faDiagramProject,
  faExpand,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faPenToSquare,
  faPlus,
  faSave,
  faSpinner,
  faTableList,
  faTrash,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getItems, type Item } from "../../api/item";
import {
  listProductionRoutings,
  saveProductionRouting,
  type ProductionRouting,
  type ProductionRoutingInput,
} from "../../api/erp";
import RoutingStageNode from "../../components/admin/RoutingProduksi/RoutingStageNode";
import RoutingStagePanel from "../../components/admin/RoutingProduksi/RoutingStagePanel";
import { validateRouting } from "../../components/admin/RoutingProduksi/validation";
import {
  fallbackRoutingItem,
  layoutPosition,
  serializeStages,
  toRoutingItem,
  type RoutingItem,
  type RoutingStageDraft,
  type RoutingStageForm,
  type StageFlowNode,
} from "../../components/admin/RoutingProduksi/types";

const nodeTypes = { routingStage: RoutingStageNode };

const toolbarButton = "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#294d77] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const rowButton = "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

type EditorMode = "canvas" | "list";

function summarizeItems(ids: string[], itemById: Map<string, RoutingItem>): string {
  if (ids.length === 0) return "Belum ada item";
  const labels = ids.map((id) => {
    const item = itemById.get(id);
    return item ? `${item.kode} - ${item.nama}` : `#${id}`;
  });
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} item`;
}

export default function RoutingProduksi() {
  const [divisions, setDivisions] = useState<Divisi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [routings, setRoutings] = useState<ProductionRouting[]>([]);
  const [stages, setStages] = useState<RoutingStageForm[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("canvas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const flowRef = useRef<ReactFlowInstance<StageFlowNode, Edge> | null>(null);
  const keySeed = useRef(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<StageFlowNode>([]);

  const nextStageKey = useCallback(() => {
    keySeed.current += 1;
    return `stage-${Date.now().toString(36)}-${keySeed.current}`;
  }, []);

  const applyLoadedData = useCallback((
    nextDivisions: Divisi[],
    nextItems: Item[],
    nextRoutings: ProductionRouting[],
  ) => {
    setDivisions(nextDivisions);
    setItems(nextItems);
    setRoutings(nextRoutings);
    setLoadError(null);

    const nextStages: RoutingStageForm[] = (nextRoutings[0]?.stages ?? []).map((stage, index) => ({
      key: nextStageKey(),
      stage: stage.stage,
      divisiId: String(stage.divisiId),
      inputItemIds: stage.inputItems.map((input) => String(input.itemId)),
      outputItemIds: stage.outputItems.map((output) => String(output.itemId)),
      position: layoutPosition(index),
    }));
    setStages(nextStages);
    setSavedSnapshot(serializeStages(nextStages));
    setEditingKey(null);
    setSaveAttempted(false);
    if (nextStages.length > 0) {
      window.setTimeout(() => flowRef.current?.fitView({ padding: 0.25 }), 150);
    }
  }, [nextStageKey]);

  const fetchData = useCallback(() => Promise.all([
    getDivisi(),
    getItems({ aktif: true }),
    listProductionRoutings(),
  ]), []);

  const load = useCallback(async () => {
    try {
      const [nextDivisions, nextItems, nextRoutings] = await fetchData();
      applyLoadedData(nextDivisions, nextItems, nextRoutings);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Gagal memuat data routing produksi.");
    } finally {
      setLoading(false);
    }
  }, [applyLoadedData, fetchData]);

  useEffect(() => {
    let active = true;
    fetchData()
      .then(([nextDivisions, nextItems, nextRoutings]) => {
        if (active) applyLoadedData(nextDivisions, nextItems, nextRoutings);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Gagal memuat data routing produksi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [applyLoadedData, fetchData]);

  const activeRouting = routings[0];
  const activeItems = useMemo(() => items.map(toRoutingItem), [items]);
  const itemById = useMemo(() => {
    const map = new Map<string, RoutingItem>();
    for (const item of activeItems) map.set(item.id, item);
    for (const routing of routings) {
      for (const stage of routing.stages) {
        for (const entry of [...stage.inputItems, ...stage.outputItems]) {
          const id = String(entry.itemId);
          if (!map.has(id)) map.set(id, fallbackRoutingItem(id, entry.item));
        }
      }
    }
    return map;
  }, [activeItems, routings]);

  const validation = useMemo(() => validateRouting(stages, itemById), [stages, itemById]);
  const dirty = savedSnapshot !== null && serializeStages(stages) !== savedSnapshot;
  const editingIndex = editingKey ? stages.findIndex((stage) => stage.key === editingKey) : -1;
  const editingStage = editingIndex >= 0 ? stages[editingIndex] : undefined;

  const edges = useMemo<Edge[]>(() => stages.slice(1).map((stage, index) => {
    const previous = stages[index]!;
    const mismatch = stage.inputItemIds.some((itemId) => !previous.outputItemIds.includes(itemId));
    const color = mismatch ? "#dc2626" : "#64748b";
    return {
      id: `${previous.key}->${stage.key}`,
      source: previous.key,
      target: stage.key,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      style: { stroke: color, strokeWidth: 2, strokeDasharray: mismatch ? "6 4" : undefined },
      focusable: false,
    };
  }), [stages]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const openStage = useCallback((key: string) => {
    setEditingKey(key);
  }, []);

  const applyDraft = useCallback((draft: RoutingStageDraft) => {
    setStages((current) => current.map((stage) => (
      stage.key === editingKey ? { ...stage, ...draft } : stage
    )));
    setEditingKey(null);
    setError(null);
  }, [editingKey]);

  const duplicateStage = useCallback((key: string) => {
    const index = stages.findIndex((stage) => stage.key === key);
    if (index < 0) return;
    const source = stages[index]!;
    const copyKey = nextStageKey();
    const suffix = " (salinan)";
    const baseName = source.stage.trim() ? source.stage : `Tahap ${index + 2}`;
    const copy: RoutingStageForm = {
      ...source,
      key: copyKey,
      stage: `${baseName.slice(0, 80 - suffix.length)}${suffix}`,
      inputItemIds: [...source.inputItemIds],
      outputItemIds: [...source.outputItemIds],
      position: layoutPosition(index + 1),
    };
    const next = [...stages.slice(0, index + 1), copy, ...stages.slice(index + 1)]
      .map((stage, stageIndex) => ({ ...stage, position: layoutPosition(stageIndex) }));
    setStages(next);
    setEditingKey(copyKey);
    setError(null);
    setNotice(null);
    window.setTimeout(() => flowRef.current?.fitView({ padding: 0.25 }), 150);
  }, [stages, nextStageKey]);

  const removeStage = useCallback((key: string) => {
    const index = stages.findIndex((stage) => stage.key === key);
    if (index < 0) return;
    const label = stages[index]!.stage.trim() || `Tahap ${index + 1}`;
    if (!window.confirm(`Hapus tahap "${label}"? Urutan tahap setelahnya akan digeser.`)) return;
    setStages(stages
      .filter((stage) => stage.key !== key)
      .map((stage, stageIndex) => ({ ...stage, position: layoutPosition(stageIndex) })));
    setEditingKey((current) => current === key ? null : current);
    setError(null);
    setNotice(null);
  }, [stages]);

  const moveStage = useCallback((key: string, offset: -1 | 1) => {
    setStages((current) => {
      const index = current.findIndex((stage) => stage.key === key);
      const destination = index + offset;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(destination, 0, moved!);
      return next.map((stage, stageIndex) => ({ ...stage, position: layoutPosition(stageIndex) }));
    });
    setError(null);
    setNotice(null);
  }, []);

  const addStage = useCallback(() => {
    const key = nextStageKey();
    const previousStage = stages[stages.length - 1];
    const divisiId = previousStage?.divisiId || (divisions[0] ? String(divisions[0].id) : "");
    const defaultOutput = activeItems.find((item) =>
      item.jenis === "SM" && String(item.divisiId) === divisiId,
    );
    const stage: RoutingStageForm = {
      key,
      stage: `Tahap ${stages.length + 1}`,
      divisiId,
      inputItemIds: previousStage ? [...previousStage.outputItemIds] : [],
      outputItemIds: defaultOutput ? [defaultOutput.id] : [],
      position: layoutPosition(stages.length),
    };
    setStages([...stages, stage]);
    setEditingKey(key);
    setError(null);
    setNotice(null);
    setSaveAttempted(false);
    window.setTimeout(() => flowRef.current?.fitView({ padding: 0.25 }), 150);
  }, [stages, divisions, activeItems, nextStageKey]);

  useEffect(() => {
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      return stages.map((stage, index) => {
        const existing = byId.get(stage.key);
        const divisionName = divisions.find((division) => String(division.id) === stage.divisiId)?.nama;
        const fallback = (id: string): RoutingItem => itemById.get(id) ?? {
          id,
          kode: `#${id}`,
          nama: "Item tidak ditemukan",
        };
        return {
          ...(existing ?? { id: stage.key }),
          id: stage.key,
          type: "routingStage" as const,
          position: stage.position,
          selected: stage.key === editingKey,
          data: {
            stageKey: stage.key,
            index,
            total: stages.length,
            title: stage.stage,
            divisionName: divisionName ?? "",
            inputs: stage.inputItemIds.map(fallback),
            outputs: stage.outputItemIds.map(fallback),
            issues: validation.stageIssues[stage.key] ?? [],
            onEdit: openStage,
            onDuplicate: duplicateStage,
            onRemove: removeStage,
            onMove: moveStage,
          },
        };
      });
    });
  }, [
    stages, divisions, itemById, validation, editingKey, setNodes,
    openStage, duplicateStage, removeStage, moveStage,
  ]);

  function resetView() {
    setStages((current) => current.map((stage, index) => ({ ...stage, position: layoutPosition(index) })));
    window.setTimeout(() => flowRef.current?.fitView({ padding: 0.25, duration: 250 }), 50);
  }

  async function saveRouting() {
    if (saving || loading) return;
    setError(null);
    setNotice(null);
    setSaveAttempted(true);

    if (validation.issueCount > 0) {
      const firstIssueKey = stages.find((stage) => (validation.stageIssues[stage.key]?.length ?? 0) > 0)?.key;
      if (firstIssueKey) setEditingKey(firstIssueKey);
      setError(validation.globalIssues[0] ?? "Routing belum valid. Perbaiki masalah yang ditandai lalu simpan kembali.");
      return;
    }

    const payload: ProductionRoutingInput = {
      stages: stages.map((stage) => ({
        stage: stage.stage.trim(),
        divisiId: Number(stage.divisiId),
        inputItemIds: stage.inputItemIds.map(Number),
        outputItemIds: stage.outputItemIds.map(Number),
      })),
    };

    setSaving(true);
    try {
      const updated = await saveProductionRouting(payload);
      const nextStages: RoutingStageForm[] = updated.stages.map((stage, index) => ({
        key: stages[index]?.key ?? nextStageKey(),
        stage: stage.stage,
        divisiId: String(stage.divisiId),
        inputItemIds: stage.inputItems.map((input) => String(input.itemId)),
        outputItemIds: stage.outputItems.map((output) => String(output.itemId)),
        position: stages[index]?.position ?? layoutPosition(index),
      }));
      setRoutings([updated]);
      setStages(nextStages);
      setSavedSnapshot(serializeStages(nextStages));
      setEditingKey(null);
      setSaveAttempted(false);
      setNotice(`Routing global versi ${updated.version} berhasil disimpan dan diaktifkan.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menyimpan routing produksi. Perubahan lokal tetap dipertahankan.");
    } finally {
      setSaving(false);
    }
  }

  const status = saving
    ? { label: "Menyimpan...", className: "bg-sky-100 text-sky-800", icon: faSpinner }
    : dirty
      ? { label: "Ada perubahan", className: "bg-amber-100 text-amber-800", icon: faTriangleExclamation }
      : { label: "Tersimpan", className: "bg-emerald-100 text-emerald-800", icon: faCircleCheck };

  const issueCount = validation.issueCount;
  const validationBadge = stages.length === 0
    ? { label: "Belum ada tahap", className: "bg-slate-100 text-slate-600", icon: faCircleNodes }
    : issueCount > 0
      ? { label: `${issueCount} masalah`, className: "bg-amber-100 text-amber-800", icon: faTriangleExclamation }
      : { label: "Routing valid", className: "bg-emerald-100 text-emerald-800", icon: faCircleCheck };

  return (
    <main className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Produksi</p>
            <h1 className="mt-1 text-3xl font-bold text-[#1E3A5F]">Routing Produksi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Susun alur produksi global sebagai rangkaian tahap yang saling terhubung. Setiap tahap memakai
              output tahap sebelumnya sebagai input dan menghasilkan item SM milik divisinya sendiri.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                <FontAwesomeIcon icon={faCircleNodes} />
                {activeRouting ? `Versi aktif ${activeRouting.version}` : "Belum ada versi aktif"}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${status.className}`}>
                <FontAwesomeIcon icon={status.icon} spin={saving} />
                {status.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                <FontAwesomeIcon icon={faDiagramProject} />
                {stages.length} tahap
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" className={secondaryButton} onClick={addStage} disabled={loading || saving}>
              <FontAwesomeIcon icon={faPlus} />
              Tambah Tahap
            </button>
            <button type="button" className={primaryButton} onClick={() => void saveRouting()} disabled={saving || loading}>
              <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
              {saving ? "Menyimpan..." : "Simpan dan Aktifkan Routing"}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          <FontAwesomeIcon icon={faSpinner} spin className="text-sky-600" />
          Memuat konfigurasi routing produksi...
        </section>
      ) : loadError ? (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            Data routing gagal dimuat
          </p>
          <p className="mt-1 text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            className={`${secondaryButton} mt-3`}
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void load();
            }}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
            Coba lagi
          </button>
        </section>
      ) : (
        <>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              <p className="flex-1">{error}</p>
              <button type="button" aria-label="Tutup pesan kesalahan" onClick={() => setError(null)} className="rounded p-0.5 hover:bg-red-100">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <FontAwesomeIcon icon={faCircleCheck} className="mt-0.5 shrink-0" />
              <p className="flex-1">{notice}</p>
              <button type="button" aria-label="Tutup pesan berhasil" onClick={() => setNotice(null)} className="rounded p-0.5 hover:bg-emerald-100">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          )}

          {stages.length > 0 && issueCount > 0 && (
            <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  {issueCount} masalah konfigurasi
                </p>
                <p className="text-xs text-amber-800">
                  {saveAttempted ? "Penyimpanan dibatalkan. Perbaiki masalah berikut." : "Routing belum bisa disimpan sebelum masalah berikut diperbaiki."}
                </p>
              </div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-amber-900">
                {validation.globalIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
                {stages.flatMap((stage, index) => (validation.stageIssues[stage.key] ?? []).map((issue) => (
                  <li key={`${stage.key}-${issue}`}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => setEditingKey(stage.key)}
                    >
                      Tahap {index + 1}: {issue}
                    </button>
                  </li>
                )))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5">
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={toolbarButton}
                  onClick={() => flowRef.current?.zoomIn({ duration: 200 })}
                  disabled={mode !== "canvas"}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                </button>
                <button
                  type="button"
                  className={toolbarButton}
                  onClick={() => flowRef.current?.zoomOut({ duration: 200 })}
                  disabled={mode !== "canvas"}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                </button>
                <button
                  type="button"
                  className={toolbarButton}
                  onClick={() => flowRef.current?.fitView({ padding: 0.25, duration: 250 })}
                  disabled={mode !== "canvas"}
                  aria-label="Sesuaikan tampilan"
                  title="Fit view"
                >
                  <FontAwesomeIcon icon={faExpand} />
                </button>
                <button
                  type="button"
                  className={toolbarButton}
                  onClick={resetView}
                  disabled={mode !== "canvas"}
                  aria-label="Reset tampilan"
                  title="Reset tampilan dan rapikan node"
                >
                  <FontAwesomeIcon icon={faArrowsRotate} />
                </button>
              </div>

              <span className="hidden h-6 w-px bg-slate-200 sm:block" />

              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <FontAwesomeIcon icon={faDiagramProject} />
                {stages.length} tahap
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${validationBadge.className}`}>
                <FontAwesomeIcon icon={validationBadge.icon} />
                {validationBadge.label}
              </span>

              <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setMode("canvas")}
                  aria-pressed={mode === "canvas"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    mode === "canvas" ? "bg-white text-[#1E3A5F] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <FontAwesomeIcon icon={faDiagramProject} />
                  Kanvas
                </button>
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  aria-pressed={mode === "list"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    mode === "list" ? "bg-white text-[#1E3A5F] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <FontAwesomeIcon icon={faTableList} />
                  Daftar
                </button>
              </div>
            </div>

            {stages.length === 0 ? (
              <div className="grid min-h-[420px] place-items-center bg-slate-50 px-6 py-12">
                <div className="max-w-md text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sky-100 text-2xl text-sky-700">
                    <FontAwesomeIcon icon={faDiagramProject} />
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-[#1E3A5F]">Belum ada tahap routing</h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Mulai dari tahap pertama, lalu hubungkan output setiap tahap menjadi input tahap berikutnya.
                  </p>
                  <button type="button" className={`${primaryButton} mt-4`} onClick={addStage}>
                    <FontAwesomeIcon icon={faPlus} />
                    Tambah tahap pertama
                  </button>
                </div>
              </div>
            ) : mode === "canvas" ? (
              <div className="h-[540px] w-full bg-slate-50 sm:h-[600px]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onNodeClick={(_, node) => setEditingKey(node.id)}
                  onNodeDragStop={(_, node) => {
                    setStages((current) => current.map((stage) => (
                      stage.key === node.id ? { ...stage, position: node.position } : stage
                    )));
                  }}
                  onInit={(instance) => { flowRef.current = instance; }}
                  fitView
                  fitViewOptions={{ padding: 0.25 }}
                  minZoom={0.3}
                  maxZoom={1.75}
                  nodesConnectable={false}
                  deleteKeyCode={null}
                  panOnScroll
                  className="bg-slate-50"
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
                </ReactFlow>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {stages.map((stage, index) => {
                  const divisionName = divisions.find((division) => String(division.id) === stage.divisiId)?.nama;
                  const issues = validation.stageIssues[stage.key] ?? [];
                  return (
                    <div key={stage.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-[#1E3A5F]">{stage.stage.trim() || "Tahap tanpa nama"}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {divisionName || "Divisi belum dipilih"}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            issues.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            <FontAwesomeIcon icon={issues.length > 0 ? faTriangleExclamation : faCircleCheck} />
                            {issues.length > 0 ? `${issues.length} masalah` : "Lengkap"}
                          </span>
                        </div>
                        <p className="flex items-start gap-1.5 text-xs text-slate-600">
                          <FontAwesomeIcon icon={faArrowRightToBracket} className="mt-0.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-words"><span className="font-semibold text-slate-700">Input:</span> {summarizeItems(stage.inputItemIds, itemById)}</span>
                        </p>
                        <p className="flex items-start gap-1.5 text-xs text-slate-600">
                          <FontAwesomeIcon icon={faArrowRightFromBracket} className="mt-0.5 shrink-0 text-sky-500" />
                          <span className="min-w-0 break-words"><span className="font-semibold text-slate-700">Output:</span> {summarizeItems(stage.outputItemIds, itemById)}</span>
                        </p>
                        {issues.length > 0 && (
                          <p className="text-xs text-amber-700">
                            {issues[0]}{issues.length > 1 ? ` (+${issues.length - 1} masalah lain)` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className={rowButton}
                          onClick={() => moveStage(stage.key, -1)}
                          disabled={index === 0}
                          aria-label={`Pindah tahap ${index + 1} ke atas`}
                        >
                          <FontAwesomeIcon icon={faChevronUp} />
                          Naik
                        </button>
                        <button
                          type="button"
                          className={rowButton}
                          onClick={() => moveStage(stage.key, 1)}
                          disabled={index === stages.length - 1}
                          aria-label={`Pindah tahap ${index + 1} ke bawah`}
                        >
                          <FontAwesomeIcon icon={faChevronDown} />
                          Turun
                        </button>
                        <button
                          type="button"
                          className={rowButton}
                          onClick={() => setEditingKey(stage.key)}
                          aria-label={`Edit tahap ${index + 1}`}
                        >
                          <FontAwesomeIcon icon={faPenToSquare} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${rowButton} border-red-200 text-red-600 hover:bg-red-50`}
                          onClick={() => removeStage(stage.key)}
                          aria-label={`Hapus tahap ${index + 1}`}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs text-slate-500">
            Klik node untuk mengatur tahap. Menarik node hanya mengubah tata letak; urutan produksi diubah lewat
            tombol naik/turun. Garis putus-putus merah menandakan input tahap tidak cocok dengan output sebelumnya.
          </p>
        </>
      )}

      {editingStage && (
        <RoutingStagePanel
          key={editingStage.key}
          stage={editingStage}
          index={editingIndex}
          total={stages.length}
          stages={stages}
          divisions={divisions}
          items={activeItems}
          itemById={itemById}
          onClose={() => setEditingKey(null)}
          onSave={applyDraft}
        />
      )}
    </main>
  );
}
