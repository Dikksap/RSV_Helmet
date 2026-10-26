import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { itemLabel, itemUnit, type RoutingItem } from "./types";

interface ItemPickerProps {
  label: string;
  hint?: string;
  items: RoutingItem[];
  selectedIds: string[];
  invalidIds: Set<string>;
  search: string;
  emptyHint: string;
  onSearchChange: (value: string) => void;
  onSelectionChange: (ids: string[]) => void;
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1";

export default function ItemPicker({
  label,
  hint,
  items,
  selectedIds,
  invalidIds,
  search,
  emptyHint,
  onSearchChange,
  onSelectionChange,
}: ItemPickerProps) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = items
    .filter((item) => `${item.kode} ${item.nama}`.toLocaleLowerCase().includes(normalizedSearch))
    .sort((left, right) => left.kode.localeCompare(right.kode));

  function toggleItem(itemId: string) {
    onSelectionChange(
      selectedIds.includes(itemId)
        ? selectedIds.filter((selectedId) => selectedId !== itemId)
        : [...selectedIds, itemId],
    );
  }

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
          {selectedIds.length}
        </span>
      </legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {hint ? <p className="max-w-[80%] text-[11px] leading-relaxed text-slate-500">{hint}</p> : <span />}
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectionChange([])}
            className={`rounded px-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 ${focusRing}`}
          >
            Bersihkan pilihan
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {selectedIds.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada item dipilih.</p>
        ) : (
          selectedIds.map((itemId) => {
            const item = itemsById.get(itemId);
            const invalid = invalidIds.has(itemId);
            return (
              <span
                key={itemId}
                className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                  invalid
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-sky-200 bg-sky-50 text-sky-800"
                }`}
                title={item ? itemLabel(item) : `Item #${itemId}`}
              >
                <span className="truncate">{item ? itemLabel(item) : `Item #${itemId}`}</span>
                <button
                  type="button"
                  aria-label={`Hapus ${item ? item.kode : `item ${itemId}`}`}
                  onClick={() => toggleItem(itemId)}
                  className={`shrink-0 rounded p-0.5 hover:bg-white/70 ${focusRing}`}
                >
                  <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                </button>
              </span>
            );
          })
        )}
      </div>

      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Cari kode atau nama item"
        aria-label={`Cari ${label.toLocaleLowerCase()}`}
      />

      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white p-1.5">
        {filteredItems.length === 0 ? (
          <p className="p-3 text-xs text-slate-500">{emptyHint}</p>
        ) : (
          <div className="space-y-0.5">
            {filteredItems.map((item) => {
              const checked = selectedIds.includes(item.id);
              const invalid = invalidIds.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex min-w-0 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs transition ${
                    checked ? "bg-sky-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0 accent-sky-600"
                    checked={checked}
                    onChange={() => toggleItem(item.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-800">{item.kode}</span>
                    <span className="block truncate text-slate-500">
                      {item.nama} · {itemUnit(item)}
                    </span>
                  </span>
                  {invalid && (
                    <span
                      className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                      title="Tidak sesuai aturan routing tahap ini"
                    >
                      <FontAwesomeIcon icon={faCircleExclamation} />
                      Tidak sesuai
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </fieldset>
  );
}
