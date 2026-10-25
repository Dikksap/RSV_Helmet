import { useEffect, useRef, useState, useMemo, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTimes,
  faCheck,
  faTag,
  faPen,
  faBox,
} from "@fortawesome/free-solid-svg-icons";
import type { Item } from "../../api/item";

type Props = {
  items: Item[];
  value: string;
  nama: string;
  onPick: (id: string) => void;
  onNama: (text: string) => void;
  ariaLabel?: string;
  listId?: string;
  inputId?: string;
  className?: string;
};

export function ItemSearchSelect({
  items,
  value,
  nama,
  onPick,
  onNama,
  ariaLabel = "Pilih atau cari barang",
  inputId = "item-search-input",
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(nama);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State koordinat posisi dropdown
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setQuery(nama);
  }, [nama]);

  // Fungsi kalkulasi posisi dropdown persis di bawah input
  const updateCoords = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  // Update posisi saat dropdown terbuka atau layar diputar/scroll
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [isOpen]);

  // Handle klik di luar input atau dropdown portal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 15);

    return items
      .filter((item) => {
        const matchNama = item.nama.toLowerCase().includes(q);
        const matchKode = item.kode?.toLowerCase().includes(q);
        const matchDivisi = item.divisi?.nama?.toLowerCase().includes(q);
        return matchNama || matchKode || matchDivisi;
      })
      .slice(0, 25);
  }, [items, query]);

  const handleSelectMaster = (item: Item) => {
    onPick(String(item.id));
    setQuery(item.nama);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputText = (text: string) => {
    setQuery(text);
    onNama(text);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onPick("");
    onNama("");
    setQuery("");
    setIsOpen(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        handleSelectMaster(filteredItems[highlightedIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Input Field */}
      <div className="relative flex items-center">
        <FontAwesomeIcon
          icon={faSearch}
          className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-slate-400"
        />

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
          }}
          onChange={(e) => handleInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          placeholder="Cari nama barang, kode, atau divisi..."
          className={`${className} pl-9 pr-9 text-xs sm:text-sm`}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Bersihkan pencarian"
            className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Render Dropdown ke Document Body via React Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${coords.top + 6}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="z-[9999] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md"
          >
            {query.trim() && !items.some((x) => String(x.id) === value) && (
              <div
                onClick={() => setIsOpen(false)}
                className="mb-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-2.5 text-xs text-amber-900 transition hover:bg-amber-100"
              >
                <FontAwesomeIcon icon={faPen} className="h-3 w-3 shrink-0 text-amber-600" />
                <div className="flex-1 truncate">
                  <span>Tulis Manual Jika tidak ada: </span>
                  <strong className="font-bold">{query}</strong>
                </div>
              </div>
            )}

            {filteredItems.length > 0 ? (
              <ul className="space-y-0.5">
                {filteredItems.map((item, idx) => {
                  const isSelected = String(item.id) === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <li
                      key={item.id}
                      onClick={() => handleSelectMaster(item)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 transition ${
                        isSelected
                          ? "bg-red-50 text-[#E30613] font-semibold"
                          : isHighlighted
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                            isSelected ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <FontAwesomeIcon icon={faBox} className="h-3 w-3" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-xs font-bold">{item.nama}</p>
                            {item.kode && (
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-slate-600">
                                {item.kode}
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[0.68rem] text-slate-400">
                            {item.divisi?.nama && (
                              <span className="flex items-center gap-1">
                                <FontAwesomeIcon icon={faTag} className="h-2.5 w-2.5" />
                                {item.divisi.nama}
                              </span>
                            )}
                            {item.unit && <span>• {item.unit}</span>}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5 shrink-0 text-[#E30613]" />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                Tidak ada barang katalog yang sesuai.
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}