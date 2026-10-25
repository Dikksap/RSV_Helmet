import {
  BARANG_PRODUKSI,
  ERP_OPERATIONS,
  KARYAWAN,
  MANAJEMEN,
  NAV_INTEGRASI,
  NAV_MAIN,
  WAREHOUSE,
} from "./admin/navigation";

import RoleLayout, { type NavGroup } from "./RoleLayout";

const GROUPS: NavGroup[] = [BARANG_PRODUKSI, MANAJEMEN, WAREHOUSE, ERP_OPERATIONS, KARYAWAN, NAV_INTEGRASI].filter(
  (g) => g.children.length > 0,
);

function AdminLayout() {
  return <RoleLayout role="admin" brand="ADMIN" subtitle="Management" titleFallback="Admin" main={NAV_MAIN} groups={GROUPS} />;
}

export default AdminLayout;
