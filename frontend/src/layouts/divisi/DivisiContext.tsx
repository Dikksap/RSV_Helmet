import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getUser } from "../../api/auth";

const ACTIVE_DIVISI_KEY = "rsv_divisi_workspace";

interface DivisiWorkspaceValue {
  isAdmin: boolean;
  divisiList: Divisi[];
  activeDivisiId: number | null;
  activeDivisiNama: string | null;
  setActiveDivisiId: (id: number | null) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const DivisiWorkspaceContext = createContext<DivisiWorkspaceValue | null>(null);

export function DivisiProvider({ children }: { children: ReactNode }) {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const [divisiList, setDivisiList] = useState<Divisi[]>([]);
  const [adminDivisiId, setAdminDivisiId] = useState<number | null>(null);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const rows = await getDivisi();
      setDivisiList(rows);
      setAdminDivisiId((current) => {
        if (current && rows.some((divisi) => divisi.id === current)) return current;
        const tersimpan = Number(localStorage.getItem(ACTIVE_DIVISI_KEY));
        return rows.find((divisi) => divisi.id === tersimpan)?.id ?? rows[0]?.id ?? null;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar divisi.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat divisi untuk admin
    void load();
  }, [load]);

  const setActiveDivisiId = (id: number | null) => {
    if (!isAdmin) return;
    setAdminDivisiId(id);
    if (id) localStorage.setItem(ACTIVE_DIVISI_KEY, String(id));
    else localStorage.removeItem(ACTIVE_DIVISI_KEY);
  };

  const activeDivisiId = isAdmin ? adminDivisiId : (user?.divisiId ?? null);
  const activeDivisiNama = isAdmin
    ? (divisiList.find((divisi) => divisi.id === activeDivisiId)?.nama ?? null)
    : (user?.divisi?.nama ?? (activeDivisiId ? `Divisi #${activeDivisiId}` : null));

  return (
    <DivisiWorkspaceContext.Provider
      value={{
        isAdmin,
        divisiList,
        activeDivisiId,
        activeDivisiNama,
        setActiveDivisiId,
        loading,
        error,
        reload: () => void load(),
      }}
    >
      {children}
    </DivisiWorkspaceContext.Provider>
  );
}

export function useDivisiWorkspace(): DivisiWorkspaceValue {
  const value = useContext(DivisiWorkspaceContext);
  if (!value) throw new Error("useDivisiWorkspace harus dipakai di dalam DivisiProvider");
  return value;
}
