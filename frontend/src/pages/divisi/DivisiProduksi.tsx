import HasilProduksiDivisi from "../admin/HasilProduksiDivisi";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

export default function DivisiProduksi() {
  const { activeDivisiId } = useDivisiWorkspace();

  return (
    <DivisiGate>
      <HasilProduksiDivisi
        key={activeDivisiId ?? "tanpa-divisi"}
        lockedDivisiId={activeDivisiId}
      />
    </DivisiGate>
  );
}
