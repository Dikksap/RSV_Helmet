export function LoadingState() {
  return (
    <div className="mt-8 grid gap-4">
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-xl bg-[#F5F7FA]" />
          <div className="h-20 rounded-xl bg-[#F5F7FA]" />
          <div className="h-20 rounded-xl bg-[#F5F7FA]" />
        </div>
        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Memuat produk dan varian...
        </p>
      </div>
    </div>
  );
}
