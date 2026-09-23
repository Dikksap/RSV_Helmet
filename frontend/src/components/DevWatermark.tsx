export default function DevWatermark() {
  if (!import.meta.env.DEV) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 left-1/2 z-10 -translate-x-1/2 select-none print:hidden"
    >
      <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black/20 backdrop-blur-sm">
        Mode Development
      </span>
    </div>
  );
}
