type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const BTN =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 disabled:cursor-not-allowed disabled:opacity-40";
const IDLE = "border-slate-200 bg-white text-slate-700 hover:border-[#1E3A5F]/40";

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const count = Math.min(totalPages, 5);
  const start = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4));
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button type="button" className={`${BTN} ${IDLE}`} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Halaman sebelumnya">
        ‹
      </button>
      {Array.from({ length: count }, (_, i) => start + i).map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === currentPage ? "page" : undefined}
          onClick={() => onPageChange(p)}
          className={`${BTN} ${p === currentPage ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : IDLE}`}
        >
          {p}
        </button>
      ))}
      <button type="button" className={`${BTN} ${IDLE}`} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Halaman berikutnya">
        ›
      </button>
      <span className="ml-2 text-xs tabular-nums text-slate-400">
        {currentPage}/{totalPages}
      </span>
    </nav>
  );
}
