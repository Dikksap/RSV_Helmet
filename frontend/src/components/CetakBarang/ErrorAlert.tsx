type ErrorAlertProps = {
  error: string | null;
  onDismiss: () => void;
};

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mt-6 flex items-start gap-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3 text-sm text-[#1F2937]"
    >
      <span
        aria-hidden="true"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EF4444] text-xs font-bold text-white"
      >
        !
      </span>
      <p className="flex-1 leading-[1.6]">{error}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg px-2 py-1 text-xs font-medium text-[#EF4444] transition-colors duration-200 hover:bg-[#EF4444]/10 focus-visible:outline-2 focus-visible:outline-[#EF4444]"
      >
        Tutup
      </button>
    </div>
  );
}
