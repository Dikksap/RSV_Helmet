type ErrorAlertProps = {
  error: string | null;
  onDismiss: () => void;
};

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  if (!error) return null;
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="mt-0.5 text-base">⚠️</span>
      <p className="flex-1">{error}</p>
      <button
        onClick={onDismiss}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
      >
        Tutup
      </button>
    </div>
  );
}
