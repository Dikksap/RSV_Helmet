import {
  BARANG_PRODUKSI,
  KARYAWAN,
  MANAJEMEN,
  NAV_INTEGRASI,
  NAV_MAIN,
  WAREHOUSE,
} from "./admin/navigation";

import RoleLayout, { type NavGroup } from "./RoleLayout";

const GROUPS: NavGroup[] = [BARANG_PRODUKSI, MANAJEMEN, WAREHOUSE, KARYAWAN, NAV_INTEGRASI].filter(
  (g) => g.children.length > 0,
);

function AdminLayout() {
  return <RoleLayout role="admin" brand="ADMIN" subtitle="Management" titleFallback="Admin" main={NAV_MAIN} groups={GROUPS} />;
}

export default AdminLayout;
