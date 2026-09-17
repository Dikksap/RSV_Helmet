import { useEffect, useRef, useState } from "react";

interface Props {
  value: string | number;
  onSave: (raw: string) => Promise<void>;
  numeric?: boolean;
  align?: "left" | "right";
}

// Klik cell → input; Enter/blur simpan, Esc batal.
export default function EditableCell({ value, onSave, numeric, align = "left" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing ]);

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const commit = async () => {
    const raw = draft.trim();
    if (raw === String(value)) {
      cancel();
      return;
    }
    if (numeric && (!/^\d+$/.test(raw) || Number(raw) < 0)) {
      setError("Harus angka ≥ 0");
      return;
    }
    setSaving(true);
    try {
      await onSave(raw);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        title="Klik untuk edit"
        onClick={() => {
          setDraft(String(value ?? ""));
          setError(null);
          setEditing(true);
        }}
        className={`w-full rounded px-1 py-0.5 transition-colors hover:bg-[#00A8E8]/10 hover:outline hover:outline-1 hover:outline-[#00A8E8]/40 ${
          align === "right" ? "text-right" : "text-left"
        } ${error ? "text-[#EF4444]" : ""}`}
      >
        {String(value ?? "")}
        {error && <span className="block text-[11px] font-normal">{error}</span>}
      </button>
    );
  }

  return (
    <span className="block">
      <input
        ref={inputRef}
        value={draft}
        inputMode={numeric ? "numeric" : undefined}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") cancel();
        }}
        className={`w-full min-w-[3rem] rounded border border-[#00A8E8] bg-white px-1 py-0.5 outline-none disabled:opacity-50 ${
          align === "right" ? "text-right" : "text-left"
        }`}
      />
      {error && <span className="block text-[11px] text-[#EF4444]">{error}</span>}
    </span>
  );
}
