import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";
import RoleLayout, { type NavGroup } from "./RoleLayout";

const GROUPS: NavGroup[] = [
  {
    label: "Inventory",
    icon: faBoxesStacked,
    children: [
      {
        to: "/supervisor/inventory",
        label: "Persetujuan Adjustment",
        icon: faBoxesStacked,
        end: true,
      },
    ],
  },
];

export default function SupervisorLayout() {
  return (
    <RoleLayout
      role="supervisor"
      profileTo="/profil"
      brand="SUPERVISOR"
      subtitle="Inventory"
      titleFallback="Persetujuan Inventory"
      main={[]}
      groups={GROUPS}
    />
  );
}
