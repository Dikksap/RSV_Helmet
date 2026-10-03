import { useEffect, useState } from "react";
import { getStatusBarangs, type MasterStatusBarang } from "../api/masterData";

export type StatusOption = {
  value: string;
  label: string;
  warna: string | null;
};

const FALLBACK: StatusOption[] = [
  { value: "REGISTER", label: "Register", warna: null },
  { value: "FINISHGOOD", label: "Finish Good", warna: null },
  { value: "RETUR", label: "Retur", warna: null },
  { value: "OUT", label: "Out", warna: null },
  { value: "BAD", label: "Bad", warna: null },
];

function toOption(r: MasterStatusBarang): StatusOption {
  return { value: r.kode, label: r.nama, warna: r.warna ?? null };
}

export function useStatusOptions(): { options: StatusOption[]; loading: boolean; error: string | null } {
  const [options, setOptions] = useState<StatusOption[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getStatusBarangs()
      .then((rows) => {
        if (!alive) return;
        const active = rows
          .filter((r) => r.isActive)
          .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama))
          .map(toOption);
        setOptions(active.length > 0 ? active : FALLBACK);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Gagal memuat status");
        setOptions(FALLBACK);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { options, loading, error };
}
