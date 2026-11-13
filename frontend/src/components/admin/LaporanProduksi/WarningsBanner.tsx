import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { ReportWarning } from "../../../api/reports";

const TONE: Record<string, string> = {
  LEGACY_UNLINKED: "border-amber-200 bg-amber-50 text-amber-900",
  LOT_TIDAK_LENGKAP: "border-amber-200 bg-amber-50 text-amber-900",
  BOM_TIDAK_LENGKAP: "border-amber-200 bg-amber-50 text-amber-900",
  BOM_NOT_FOUND: "border-amber-200 bg-amber-50 text-amber-900",
  PH_LEGACY: "border-slate-200 bg-slate-50 text-slate-700",
  REJECT_TIDAK_DAPAT_DIATRIBUSIKAN: "border-slate-200 bg-slate-50 text-slate-700",
  FILTER_VARIAN: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function WarningsBanner({ warnings }: { warnings: ReportWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.code}
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${TONE[warning.code] ?? "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
          <p>
            <span className="font-bold">{warning.code}</span>
            {typeof warning.count === "number" ? ` (${warning.count.toLocaleString("id-ID")})` : ""} —{" "}
            {warning.message}
          </p>
        </div>
      ))}
    </div>
  );
}
