export function LoadingState() {
  return (
    <div className="mt-8 grid gap-4">
      <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-8">
        <div className="h-4 w-32 rounded bg-zinc-200" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-xl bg-zinc-100" />
          <div className="h-20 rounded-xl bg-zinc-100" />
          <div className="h-20 rounded-xl bg-zinc-100" />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Memuat produk dan varian...
        </p>
      </div>
    </div>
  );
}
