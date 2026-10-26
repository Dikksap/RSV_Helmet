import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCopy,
  faPenToSquare,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { itemLabel, type RoutingItem, type StageFlowNode } from "./types";

const iconButton = "grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30";

function ItemSummary({ label, items, emptyText, tone }: {
  label: string;
  items: RoutingItem[];
  emptyText: string;
  tone: "input" | "output";
}) {
  const color = tone === "input" ? "text-slate-600" : "text-sky-700";
  return (
    <div className="min-w-0">
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${color}`}>
        <FontAwesomeIcon icon={tone === "input" ? faArrowRightToBracket : faArrowRightFromBracket} />
        {label}
        <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{items.length}</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-red-500">{emptyText}</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {items.slice(0, 2).map((item) => (
            <p key={item.id} className="truncate text-[11px] text-slate-600" title={itemLabel(item)}>
              <span className="font-semibold text-slate-800">{item.kode}</span> · {item.nama}
            </p>
          ))}
          {items.length > 2 && (
            <p className="text-[10px] font-semibold text-slate-400">+{items.length - 2} item lainnya</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutingStageNode({ data, selected }: NodeProps<StageFlowNode>) {
  const hasIssues = data.issues.length > 0;
  const isFirst = data.index === 0;
  const isLast = data.index === data.total - 1;

  function run(event: React.MouseEvent, action: () => void) {
    event.stopPropagation();
    action();
  }

  return (
    <div
      className={`w-[292px] overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        selected
          ? "border-sky-500 ring-2 ring-sky-100"
          : hasIssues
            ? "border-amber-300"
            : "border-slate-200"
      }`}
    >
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500"
        />
      )}

      <div className="flex items-center gap-2.5 border-b border-slate-200 px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
          {data.index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#1E3A5F]" title={data.title}>
            {data.title || "Tahap tanpa nama"}
          </p>
          <p className="truncate text-[11px] text-slate-500">{data.divisionName || "Divisi belum dipilih"}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
            hasIssues ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          }`}
          title={hasIssues ? data.issues.join("\n") : "Konfigurasi tahap lengkap"}
        >
          <FontAwesomeIcon icon={hasIssues ? faTriangleExclamation : faCircleCheck} />
          {hasIssues ? `${data.issues.length} masalah` : "Lengkap"}
        </span>
      </div>

      <div className="grid gap-2.5 px-3 py-2.5">
        <ItemSummary label="Input" items={data.inputs} emptyText="Belum ada item input" tone="input" />
        <ItemSummary label="Output" items={data.outputs} emptyText="Belum ada item output" tone="output" />
      </div>

      {hasIssues && (
        <p className="mx-3 mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800">
          {data.issues[0]}
          {data.issues.length > 1 ? ` (+${data.issues.length - 1} masalah lain)` : ""}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={`${iconButton} nodrag`}
            aria-label={`Pindah tahap ${data.index + 1} ke atas`}
            title="Pindah ke atas"
            disabled={isFirst}
            onClick={(event) => run(event, () => data.onMove(data.stageKey, -1))}
          >
            <FontAwesomeIcon icon={faChevronUp} className="text-[11px]" />
          </button>
          <button
            type="button"
            className={`${iconButton} nodrag`}
            aria-label={`Pindah tahap ${data.index + 1} ke bawah`}
            title="Pindah ke bawah"
            disabled={isLast}
            onClick={(event) => run(event, () => data.onMove(data.stageKey, 1))}
          >
            <FontAwesomeIcon icon={faChevronDown} className="text-[11px]" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={`${iconButton} nodrag`}
            aria-label={`Edit tahap ${data.index + 1}`}
            title="Edit tahap"
            onClick={(event) => run(event, () => data.onEdit(data.stageKey))}
          >
            <FontAwesomeIcon icon={faPenToSquare} className="text-[11px]" />
          </button>
          <button
            type="button"
            className={`${iconButton} nodrag`}
            aria-label={`Gandakan tahap ${data.index + 1}`}
            title="Gandakan tahap"
            onClick={(event) => run(event, () => data.onDuplicate(data.stageKey))}
          >
            <FontAwesomeIcon icon={faCopy} className="text-[11px]" />
          </button>
          <button
            type="button"
            className={`${iconButton} nodrag text-red-500 hover:bg-red-50 hover:text-red-700`}
            aria-label={`Hapus tahap ${data.index + 1}`}
            title="Hapus tahap"
            onClick={(event) => run(event, () => data.onRemove(data.stageKey))}
          >
            <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
          </button>
        </div>
      </div>

      {!isLast && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500"
        />
      )}
    </div>
  );
}
