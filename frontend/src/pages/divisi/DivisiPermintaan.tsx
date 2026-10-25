import DaftarPermintaan from "../admin/DaftarPermintaan";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

export default function DivisiPermintaan() {
  const { activeDivisiId, activeDivisiNama } = useDivisiWorkspace();

  return (
    <DivisiGate>
      <DaftarPermintaan
        key={activeDivisiId ?? "tanpa-divisi"}
        lockedDivisiId={activeDivisiId}
        lockedDivisiNama={activeDivisiNama}
      />
    </DivisiGate>
  );
}
