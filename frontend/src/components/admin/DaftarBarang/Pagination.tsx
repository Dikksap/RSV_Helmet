type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-1 sm:justify-center sm:gap-2">
      <button
        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Halaman sebelumnya"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        <span className="hidden sm:inline">Sebelumnya</span>
        <span className="sm:hidden">Prev</span>
      </button>

      {/* Numbers: compact scroll on mobile */}
      <div className="flex max-w-[40vw] items-center gap-1 overflow-x-auto px-0.5 sm:max-w-none">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;

          const active = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 min-w-12 shrink-0 items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums transition duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-95 ${
                active
                  ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-[0_4px_20px_rgba(30,58,95,0.25)]"
                  : "border-[#D1D5DB] bg-white text-[#1F2937] hover:border-[#00A8E8] hover:text-[#00A8E8]"
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Halaman berikutnya"
      >
        <span className="hidden sm:inline">Selanjutnya</span>
        <span className="sm:hidden">Next</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </nav>
  );
}
