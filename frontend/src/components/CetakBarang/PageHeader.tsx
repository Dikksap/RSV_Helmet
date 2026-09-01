type PageHeaderProps = {
  completionSteps: number;
};

export function PageHeader({ completionSteps }: PageHeaderProps) {
  return (
    <div className="border-b border-zinc-200 py-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
            Product Inventory / Generate
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
            GENERATE BARANG
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
            Pilih varian yang tersedia untuk membuat satu barang dan cetak
            hangtag secara langsung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Progress
            </p>
            <p className="text-sm font-bold text-zinc-900">
              {completionSteps} / 4 langkah
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-2 w-8 rounded-full transition ${s <= completionSteps ? "bg-zinc-900" : "bg-zinc-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
