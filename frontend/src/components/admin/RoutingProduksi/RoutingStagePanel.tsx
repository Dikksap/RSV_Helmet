import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faCheck,
  faCircleExclamation,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { Divisi } from "../../../api/divisi";
import ItemPicker from "./ItemPicker";
import { validateRouting } from "./validation";
import type {
  RoutingItem,
  RoutingStageDraft,
  RoutingStageForm,
} from "./types";

interface RoutingStagePanelProps {
  stage: RoutingStageForm;
  index: number;
  total: number;
  stages: RoutingStageForm[];
  divisions: Divisi[];
  items: RoutingItem[];
  itemById: Map<string, RoutingItem>;
  onClose: () => void;
  onSave: (draft: RoutingStageDraft) => void;
}

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1";

export default function RoutingStagePanel({
  stage,
  index,
  total,
  stages,
  divisions,
  items,
  itemById,
  onClose,
  onSave,
}: RoutingStagePanelProps) {
  const [draft, setDraft] = useState<RoutingStageDraft>(() => ({
    stage: stage.stage,
    divisiId: stage.divisiId,
    inputItemIds: [...stage.inputItemIds],
    outputItemIds: [...stage.outputItemIds],
  }));
  const [inputSearch, setInputSearch] = useState("");
  const [outputSearch, setOutputSearch] = useState("");

  const divisionId = draft.divisiId ? Number(draft.divisiId) : 0;
  const previousStage = index > 0 ? stages[index - 1] : undefined;
  const nextStage = stages[index + 1];
  const firstStage = index === 0;

  const allowedInputIds = useMemo(() => {
    if (firstStage) {
      return new Set(items.filter((item) => item.divisiId === divisionId).map((item) => item.id));
    }
    return new Set(previousStage?.outputItemIds ?? []);
  }, [firstStage, items, divisionId, previousStage]);

  const allowedOutputIds = useMemo(
    () => new Set(items.filter((item) => item.jenis === "SM" && item.divisiId === divisionId).map((item) => item.id)),
    [items, divisionId],
  );

  const invalidInputIds = new Set(draft.inputItemIds.filter((id) => {
    const item = itemById.get(id);
    if (!item) return true;
    if (item.divisiId === undefined) return false;
    return !allowedInputIds.has(id);
  }));
  const invalidOutputIds = new Set(draft.outputItemIds.filter((id) => {
    const item = itemById.get(id);
    if (!item) return true;
    if (item.jenis === undefined) return false;
    return !allowedOutputIds.has(id);
  }));

  function optionsFor(allowedIds: Set<string>, selectedIds: string[]): RoutingItem[] {
    const options = new Map<string, RoutingItem>();
    for (const item of items) {
      if (allowedIds.has(item.id)) options.set(item.id, item);
    }
    for (const id of selectedIds) {
      if (options.has(id)) continue;
      options.set(id, itemById.get(id) ?? { id, kode: `#${id}`, nama: "Item tidak ditemukan" });
    }
    return [...options.values()];
  }

  const inputOptions = optionsFor(allowedInputIds, draft.inputItemIds);
  const outputOptions = optionsFor(allowedOutputIds, draft.outputItemIds);

  const draftStage: RoutingStageForm = { ...stage, ...draft };
  const validation = validateRouting(
    stages.map((current, currentIndex) => currentIndex === index ? draftStage : current),
    itemById,
  );
  const issues = validation.stageIssues[stage.key] ?? [];
  const baseValidation = useMemo(() => validateRouting(stages, itemById), [stages, itemById]);
  const nextStageIssues = nextStage ? validation.stageIssues[nextStage.key] ?? [] : [];
  const newNextStageIssues = nextStage
    ? nextStageIssues.filter((issue) => !(baseValidation.stageIssues[nextStage.key] ?? []).includes(issue))
    : [];

  const dirty =
    draft.stage !== stage.stage ||
    draft.divisiId !== stage.divisiId ||
    draft.inputItemIds.join(",") !== stage.inputItemIds.join(",") ||
    draft.outputItemIds.join(",") !== stage.outputItemIds.join(",");

  function requestClose() {
    if (dirty && !window.confirm("Perubahan pada tahap ini belum diterapkan. Tutup panel pengaturan?")) return;
    onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  });

  function updateDraft(update: Partial<RoutingStageDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  const divisionName = divisions.find((division) => String(division.id) === draft.divisiId)?.nama;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="routing-stage-panel-title"
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        aria-label="Tutup pengaturan tahap"
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-slate-900/40"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">
              Pengaturan tahap {index + 1} dari {total}
            </p>
            <h2 id="routing-stage-panel-title" className="mt-1 truncate text-lg font-bold text-[#1E3A5F]">
              {draft.stage.trim() || "Tahap tanpa nama"}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {divisionName || "Divisi belum dipilih"}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Tutup panel"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${focusRing}`}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Nama tahap
              <input
                className={`${field} mt-1`}
                value={draft.stage}
                maxLength={80}
                onChange={(event) => updateDraft({ stage: event.target.value })}
                placeholder="Contoh: Buffing"
              />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">{draft.stage.length}/80 karakter</span>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Divisi produksi
              <select
                className={`${field} mt-1`}
                value={draft.divisiId}
                onChange={(event) => updateDraft({ divisiId: event.target.value })}
              >
                <option value="">Pilih divisi</option>
                {divisions.map((division) => (
                  <option key={division.id} value={division.id}>{division.nama}</option>
                ))}
              </select>
            </label>
          </div>

          {invalidOutputIds.size > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              <p>
                {invalidOutputIds.size} item output tidak sesuai dengan divisi yang dipilih. Item lama tidak dihapus
                otomatis; ganti atau hapus item yang ditandai <strong>Tidak sesuai</strong>.
              </p>
            </div>
          )}

          <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <ItemPicker
              label="Item input"
              hint={firstStage
                ? "Tahap pertama: item input harus terdaftar pada divisi yang dipilih."
                : `Tahap ${index + 1}: item input harus berasal dari output tahap ${index}${previousStage?.stage ? ` (${previousStage.stage})` : ""}.`}
              items={inputOptions}
              selectedIds={draft.inputItemIds}
              invalidIds={invalidInputIds}
              search={inputSearch}
              emptyHint={firstStage
                ? "Belum ada item untuk divisi ini. Pilih divisi atau tambahkan item terlebih dahulu."
                : "Output tahap sebelumnya belum tersedia."}
              onSearchChange={setInputSearch}
              onSelectionChange={(inputItemIds) => updateDraft({ inputItemIds })}
            />

            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <FontAwesomeIcon icon={faArrowRightToBracket} />
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <ItemPicker
              label="Item output"
              hint="Hanya item berjenis SM yang merupakan milik divisi yang dipilih."
              items={outputOptions}
              selectedIds={draft.outputItemIds}
              invalidIds={invalidOutputIds}
              search={outputSearch}
              emptyHint={divisionId
                ? "Belum ada item SM untuk divisi ini."
                : "Pilih divisi produksi terlebih dahulu."}
              onSearchChange={setOutputSearch}
              onSelectionChange={(outputItemIds) => updateDraft({ outputItemIds })}
            />
          </div>

          {issues.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                <FontAwesomeIcon icon={faCircleExclamation} />
                Tahap ini belum valid
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-red-700">
                {issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
              <p className="mt-1.5 text-[11px] text-red-600">
                Perubahan tetap dapat diterapkan ke editor, tetapi routing belum bisa disimpan sampai masalah ini diperbaiki.
              </p>
            </div>
          )}

          {newNextStageIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <p className="flex items-center gap-1.5 font-bold">
                <FontAwesomeIcon icon={faTriangleExclamation} />
                Tahap berikutnya perlu disesuaikan
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {newNextStageIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <FontAwesomeIcon icon={faArrowRightFromBracket} />
            Urutan bisnis diatur dari tombol pindah, bukan posisi node.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 ${focusRing}`}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className={`inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#294d77] ${focusRing}`}
            >
              <FontAwesomeIcon icon={faCheck} />
              Simpan perubahan
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
