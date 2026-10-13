import RoleLayout from "./RoleLayout";
import { GUDANG_GROUPS, GUDANG_MAIN } from "./gudang/navigation";

function GudangLayout() {
  return (
    <RoleLayout
      role="gudang"
      brand="GUDANG"
      subtitle="Warehouse"
      titleFallback="Gudang"
      main={GUDANG_MAIN}
      groups={GUDANG_GROUPS}
    />
  );
}

export default GudangLayout;
