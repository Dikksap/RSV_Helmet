import RoleLayout from "./RoleLayout";
import { DivisiProvider, useDivisiWorkspace } from "./divisi/DivisiContext";
import { DIVISI_GROUPS, DIVISI_MAIN } from "./divisi/navigation";
import { getUser, hasPermission } from "../api/auth";

const ALLOWED_ROLES = ["admin", "gudang", "user", "produksi", "qc"];

function DivisiSubheader() {
  const {
    isAdmin,
    divisiList,
    activeDivisiId,
    activeDivisiNama,
    setActiveDivisiId,
    loading,
    error,
  } = useDivisiWorkspace();

  if (!isAdmin) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-[#6B7280]">Divisi aktif:</span>
        <span className="rounded-full bg-[#E6F6FD] px-3 py-1 font-semibold text-[#0077A8]">
          {activeDivisiNama ?? "Belum terhubung"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor="divisi-workspace" className="font-medium text-[#6B7280]">
        Divisi aktif
      </label>
      <select
        id="divisi-workspace"
        className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#1F2937] outline-none focus:border-[#00A8E8]"
        value={activeDivisiId ?? ""}
        onChange={(event) =>
          setActiveDivisiId(event.target.value ? Number(event.target.value) : null)
        }
        disabled={loading || divisiList.length === 0}
      >
        {divisiList.length === 0 && <option value="">Belum ada divisi</option>}
        {divisiList.map((divisi) => (
          <option key={divisi.id} value={divisi.id}>
            {divisi.nama}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-[#6B7280]">Memuat divisi...</span>}
      {error && (
        <span role="alert" className="text-xs text-[#B91C1C]">
          {error}
        </span>
      )}
    </div>
  );
}

export default function DivisiLayout() {
  const role = getUser()?.role;
  const groups = DIVISI_GROUPS.map((group) => ({
    ...group,
    children: group.children.filter((item) =>
      item.to !== "/divisi/quality" || role === "admin" || role === "qc" || hasPermission("REPAIR_WORK"),
    ),
  })).filter((group) => group.children.length > 0);

  return (
    <DivisiProvider>
      <RoleLayout
        role="divisi"
        allowedRoles={ALLOWED_ROLES}
        profileTo="/profil"
        subheader={<DivisiSubheader />}
        brand="DIVISI"
        subtitle="Operasional"
        titleFallback="Divisi"
        main={DIVISI_MAIN}
        groups={groups}
      />
    </DivisiProvider>
  );
}
