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
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <button
        className="rounded-xl border border-brand-border bg-brand-surface-card px-4 py-2 text-sm font-semibold text-brand-grey-light transition hover:border-brand-gold hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        Sebelumnya
      </button>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;

          return (
            <button
              key={pageNum}
              className={`h-9 min-w-9 rounded-xl border text-sm font-bold transition ${
                currentPage === pageNum
                  ? "border-brand-gold bg-brand-gold text-brand-black"
                  : "border-brand-border bg-brand-surface-card text-brand-grey-light hover:border-brand-gold hover:text-white"
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
      </div>
      <button
        className="rounded-xl border border-brand-border bg-brand-surface-card px-4 py-2 text-sm font-semibold text-brand-grey-light transition hover:border-brand-gold hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Selanjutnya
      </button>
    </div>
  );
}
