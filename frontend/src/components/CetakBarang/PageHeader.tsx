type PageHeaderProps = {
  completionSteps: number;
};

export function PageHeader({ completionSteps }: PageHeaderProps) {
  return (
    <div className="py-5 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#00A8E8]">
            Produk / Generate Barang
          </p>
          <h1 className="text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">
            Generate Barang
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.6] text-[#6B7280] md:text-base">
            Pilih varian yang tersedia untuk membuat satu barang dan cetak
            hangtag secara langsung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium uppercase tracking-widest text-[#6B7280]">
              Progress
            </p>
            <p className="text-sm font-semibold text-[#1F2937]">
              {completionSteps} / 4 langkah
            </p>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-2 w-8 rounded-full transition-colors duration-200 ${s <= completionSteps ? "bg-[#00A8E8]" : "bg-slate-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
