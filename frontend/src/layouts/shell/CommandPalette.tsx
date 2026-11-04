import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faMagnifyingGlass,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import type { PaletteEntry } from "./nav-utils";

export interface CommandPaletteProps {
  entries: PaletteEntry[];
  onClose: () => void;
}

export function CommandPalette({ entries, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(({ item, groupLabel, description }) =>
      [item.label, description ?? "", groupLabel].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [entries, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const safeIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const open = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onClose();
    navigate(entry.item.to);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0 ? 0 : (index - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      open(results[safeIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-navy-950/55 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari menu"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_32px_80px_-24px_rgba(8,17,29,0.45)]"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[safeIndex] ? `palette-item-${safeIndex}` : undefined}
            aria-autocomplete="list"
            placeholder="Cari modul, menu, atau halaman…"
            className="h-12 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-1.5 text-[10.5px] font-medium text-slate-500">
          {results.length} modul · gunakan <kbd className="font-sans font-semibold">↑ ↓</kbd> untuk
          memilih, <kbd className="font-sans font-semibold">Enter</kbd> untuk membuka
        </div>

        <ul
          id="palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Hasil pencarian menu"
          className="max-h-[46vh] overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <li className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Menu tidak ditemukan</p>
              <p className="mt-1 text-xs text-slate-500">
                Tidak ada hasil untuk “{query}”. Coba kata kunci lain.
              </p>
            </li>
          )}

          {results.map((entry, index) => {
            const active = index === safeIndex;
            return (
              <li key={`${entry.group}-${entry.item.to}`}>
                <button
                  type="button"
                  id={`palette-item-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => open(entry)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-navy-600/[0.07] text-navy-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      active ? "bg-white text-accent-600 shadow-sm" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={entry.item.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{entry.item.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {entry.groupLabel}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </span>
                  </span>
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className={`h-3 w-3 shrink-0 ${active ? "text-accent-500" : "text-slate-300"}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
