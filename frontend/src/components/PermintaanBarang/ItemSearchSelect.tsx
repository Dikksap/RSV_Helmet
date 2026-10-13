import { useEffect, useRef, useState } from "react";
import type { Item } from "../../api/item";

/* ---------- Satu input: ketik = tulis bebas, pilih dropdown = master ---------- */
export function ItemSearchSelect({
  items,
  value,
  nama,
  onPick,
  onNama,
  ariaLabel,
  listId,
  className,
  inputId,
}: {
  items: Item[];
  value: string;
  nama: string;
  onPick: (id: string) => void;
  onNama: (text: string) => void;
  ariaLabel: string;
  listId: string;
  className: string;
  inputId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected =
    items.find((item) => String(item.id) === value) ?? null;

  const normalizedQuery = selected ? "" : nama.trim().toLowerCase();

  const matches = (
    normalizedQuery
      ? items.filter((item) => {
          const kode = String(item.kode ?? "").toLowerCase();
          const namaItem = String(item.nama ?? "").toLowerCase();
          const unit = String(item.unit ?? "").toLowerCase();

          return (
            kode.includes(normalizedQuery) ||
            namaItem.includes(normalizedQuery) ||
            unit.includes(normalizedQuery)
          );
        })
      : items
  ).slice(0, 8);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        boxRef.current &&
        !boxRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setActiveIndex(0);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(0);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const pick = (id: string) => {
    onPick(id);
    setActiveIndex(0);
    setOpen(false);
  };

  const clear = () => {
    if (selected) {
      onPick("");
    } else {
      onNama("");
    }
    setActiveIndex(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Saran hanya muncul setelah pengguna mengetik sesuatu.
  const canSuggest = !selected && normalizedQuery !== "";
  const showList = open && canSuggest;

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (selected || !canSuggest) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current >= matches.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? matches.length - 1 : current + 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const item = matches[activeIndex];
      if (item) {
        pick(String(item.id));
      } else {
        setOpen(false);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(0);
    }
  };

  const display = selected ? `${selected.kode} — ${selected.nama}` : nama;

  return (
    <div className="relative" ref={boxRef}>
      <input
        ref={inputRef}
        type="text"
        id={inputId}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          showList ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        value={display}
        readOnly={Boolean(selected)}
        title={selected ? "Master terpilih — tekan ✕ untuk tulis bebas" : undefined}
        onChange={(event) => {
          // Lepaskan master ketika pengguna mulai mengetik lagi.
          if (selected) {
            onPick("");
          }
          onNama(event.target.value);
          setActiveIndex(0);
          setOpen(event.target.value.trim() !== "");
        }}
        onFocus={() => {
          if (canSuggest) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ketik nama barang atau cari master (kode/nama)..."
        className={`${className} ${selected ? "bg-[#F3F3F3] font-semibold" : ""}`}
      />

      {display && (
        <button
          type="button"
          onClick={clear}
          aria-label={selected ? "Lepas master, tulis bebas" : "Hapus nama barang"}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#A3A3A3] hover:bg-[#E30613]/10 hover:text-[#E30613]"
        >
          ✕
        </button>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#DADADA] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
        >
          {matches.map((item, index) => {
            const id = String(item.id);
            const isActive = activeIndex === index;

            return (
              <li key={id} role="presentation">
                <button
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(id)}
                  className={`block w-full px-3 py-2 text-left text-[0.85rem] ${
                    isActive ? "bg-[#E30613]/10" : "hover:bg-[#E30613]/5"
                  } text-[#171717]`}
                >
                  <span className="font-mono">
                    {item.kode}
                  </span>{" "}
                  — {item.nama}{" "}
                  <span className="text-[#A3A3A3]">
                    ({item.unit})
                  </span>
                </button>
              </li>
            );
          })}

          {matches.length === 0 && (
            <li
              role="presentation"
              className="px-3 py-2 text-[0.85rem] italic text-[#A3A3A3]"
            >
              Tidak ada yang cocok — teks dipakai sebagai tulis bebas.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
