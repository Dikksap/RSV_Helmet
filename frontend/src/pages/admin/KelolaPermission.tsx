import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faLock } from "@fortawesome/free-solid-svg-icons";
import {
  getRoles, getPermissions, setRolePermissions, setRoleBarangStatus,
  type Role, type RolePermission,
} from "../../api/role";
import { getStatusBarangs } from "../../api/masterData";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const thCls = "px-4 py-3 text-xs font-semibold uppercase tracking-wider";
const cellCls = "px-4 py-3 text-center";

const ADMIN = "admin";

function keyOf(roleId: number, kind: "grant" | "status") {
  return `${roleId}:${kind}`;
}

export default function KelolaPermission() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [statusKodes, setStatusKodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<number, string[]>>({});
  const [views, setViews] = useState<Record<number, Record<string, boolean>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, s] = await Promise.all([getRoles(), getPermissions(), getStatusBarangs()]);
      setRoles(r);
      setPermissions(p);
      const kodes = s.filter((x) => x.isActive).map((x) => x.kode);
      setStatusKodes(kodes.length > 0 ? kodes : ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"]);
      setGrants(Object.fromEntries(r.map((x) => [x.id, x.permissions.map((q) => q.kode)])));
      setViews(Object.fromEntries(r.map((x) => [
        x.id,
        Object.fromEntries(kodes.map((k) => [k, x.barangStatus.find((v) => v.statusKode === k)?.canView ?? false])),
      ])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data permission.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat awal sekali, pola sama seperti KelolaUser
    void load();
  }, [load]);

  const permGroups = useMemo(() => {
    const map = new Map<string, RolePermission[]>();
    for (const p of permissions) {
      const list = map.get(p.kelompok) ?? [];
      list.push(p);
      map.set(p.kelompok, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const grantDirty = (r: Role) =>
    JSON.stringify([...(grants[r.id] ?? [])].sort()) !==
    JSON.stringify(r.permissions.map((p) => p.kode).sort());
  const viewDirty = (r: Role) =>
    JSON.stringify(views[r.id] ?? {}) !==
    JSON.stringify(Object.fromEntries(statusKodes.map((k) => [k, r.barangStatus.find((v) => v.statusKode === k)?.canView ?? false])));

  const toggleGrant = (roleId: number, kode: string) =>
    setGrants((g) => {
      const cur = g[roleId] ?? [];
      return { ...g, [roleId]: cur.includes(kode) ? cur.filter((c) => c !== kode) : [...cur, kode] };
    });

  const toggleView = (roleId: number, kode: string) =>
    setViews((v) => ({ ...v, [roleId]: { ...(v[roleId] ?? {}), [kode]: !(v[roleId]?.[kode] ?? false) } }));

  const saveGrant = async (r: Role) => {
    setBusy(keyOf(r.id, "grant"));
    try {
      await setRolePermissions(r.id, grants[r.id] ?? []);
      flash(`Permission role "${r.kode}" disimpan.`);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(null);
    }
  };

  const saveView = async (r: Role) => {
    setBusy(keyOf(r.id, "status"));
    try {
      await setRoleBarangStatus(r.id, views[r.id] ?? {});
      flash(`Visibilitas status role "${r.kode}" disimpan.`);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(null);
    }
  };

  const editable = roles.filter((r) => r.kode !== ADMIN);

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Akses</p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Kelola Permission</h1>
        <p className="mt-2 text-base text-[#6B7280]">Atur grant permission dan visibilitas status barang per role. Role admin selalu punya semua akses dan terkunci.</p>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data permission...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-6">
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h2 className="border-b border-slate-100 px-6 py-4 text-lg font-bold text-[#1E3A5F]">Grant Permission</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className={thCls}>Permission</th>
                    {roles.map((r) => (
                      <th key={r.id} className={`${thCls} text-center`}>
                        <span className="mr-2">{r.kode}</span>
                        {r.kode === ADMIN ? (
                          <FontAwesomeIcon icon={faLock} className="h-3 w-3 text-slate-400" title="Terkunci: admin selalu punya semua akses" />
                        ) : (
                          <button
                            type="button"
                            disabled={busy !== null || !grantDirty(r)}
                            onClick={() => void saveGrant(r)}
                            className={primaryBtn}
                          >
                            <FontAwesomeIcon icon={faFloppyDisk} className="h-3.5 w-3.5" />
                            {busy === keyOf(r.id, "grant") ? "Menyimpan..." : "Simpan"}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permGroups.map(([kelompok, list]) => (
                    <Fragment key={`g-${kelompok}`}>
                      <tr key={`g-${kelompok}`} className="bg-slate-50">
                        <td colSpan={roles.length + 1} className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">{kelompok}</td>
                      </tr>
                      {list.map((p) => (
                        <tr key={p.kode} className="text-[15px] hover:bg-[#F5F7FA]">
                          <td className="px-6 py-3">
                            <span className="font-mono text-sm font-medium text-[#1F2937]">{p.kode}</span>
                            <span className="ml-2 text-[13px] text-[#6B7280]">{p.nama}</span>
                          </td>
                          {roles.map((r) => (
                            <td key={r.id} className={cellCls}>
                              {r.kode === ADMIN ? (
                                <span className="text-[13px] font-medium text-[#10B981]">Ya</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={`${p.kode} untuk ${r.kode}`}
                                  checked={(grants[r.id] ?? []).includes(p.kode)}
                                  onChange={() => toggleGrant(r.id, p.kode)}
                                  className="h-4 w-4 accent-[#00A8E8]"
                                />
                              )}
                            </td>
                          )                          )}
                        </tr>
                      ))}
                    </Fragment>
                  ))}

                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h2 className="border-b border-slate-100 px-6 py-4 text-lg font-bold text-[#1E3A5F]">Visibilitas Status Barang</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className={thCls}>Status</th>
                    {roles.map((r) => (
                      <th key={r.id} className={`${thCls} text-center`}>
                        <span className="mr-2">{r.kode}</span>
                        {r.kode === ADMIN ? (
                          <FontAwesomeIcon icon={faLock} className="h-3 w-3 text-slate-400" title="Terkunci: admin selalu melihat semua status" />
                        ) : (
                          <button
                            type="button"
                            disabled={busy !== null || !viewDirty(r)}
                            onClick={() => void saveView(r)}
                            className={primaryBtn}
                          >
                            <FontAwesomeIcon icon={faFloppyDisk} className="h-3.5 w-3.5" />
                            {busy === keyOf(r.id, "status") ? "Menyimpan..." : "Simpan"}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statusKodes.map((k) => (
                    <tr key={k} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-3 font-mono text-sm font-medium text-[#1F2937]">{k}</td>
                      {roles.map((r) => (
                        <td key={r.id} className={cellCls}>
                          {r.kode === ADMIN ? (
                            <span className="text-[13px] font-medium text-[#10B981]">Lihat</span>
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`Status ${k} untuk ${r.kode}`}
                              checked={views[r.id]?.[k] ?? false}
                              onChange={() => toggleView(r.id, k)}
                              className="h-4 w-4 accent-[#00A8E8]"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {editable.length === 0 && (
            <p className="text-sm italic text-[#6B7280]">Belum ada role selain admin.</p>
          )}
        </main>
      )}
    </div>
  );
}
