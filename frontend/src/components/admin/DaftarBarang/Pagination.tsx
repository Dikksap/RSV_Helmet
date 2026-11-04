import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

type PageItem = number | "gap-start" | "gap-end";

const ARROW =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#1E3A5F]/30 hover:bg-slate-50 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 disabled:cursor-not-allowed disabled:opacity-40";
const PAGE =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";

function buildPages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  if (current <= 3) {
    start = 2;
    end = 4;
  }
  if (current >= total - 2) {
    start = total - 3;
    end = total - 1;
  }

  const items: PageItem[] = [1];
  if (start > 2) items.push("gap-start");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("gap-end");
  items.push(total);
  return items;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPages(currentPage, totalPages);

  return (
    <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
      <button
        type="button"
        className={ARROW}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Halaman sebelumnya"
        title="Halaman sebelumnya"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="h-2.5 w-2.5" aria-hidden="true" />
      </button>

      <div className="hidden items-center gap-0.5 sm:flex">
        {pages.map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === currentPage ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`${PAGE} ${
                item === currentPage
                  ? "bg-[#1E3A5F] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[#1E3A5F]"
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="px-0.5 text-xs text-slate-500" aria-hidden="true">
              …
            </span>
          ),
        )}
      </div>

      <span className="px-1.5 text-[11px] font-medium tabular-nums text-slate-500 sm:hidden">
        Hal {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        className={ARROW}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Halaman berikutnya"
        title="Halaman berikutnya"
      >
        <FontAwesomeIcon icon={faChevronRight} className="h-2.5 w-2.5" aria-hidden="true" />
      </button>
    </nav>
  );
}
