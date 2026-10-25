import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, type IconDefinition } from "@fortawesome/free-solid-svg-icons";

interface Props {
  icon: IconDefinition;
  title: string;
  description: string;
  divisiNama: string;
  actions?: ReactNode;
}

export default function DivisiPageHeader({
  icon,
  title,
  description,
  divisiNama,
  actions,
}: Props) {
  return (
    <header className="space-y-3">
      <Link
        to="/divisi/home"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077A8] hover:underline lg:hidden"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" aria-hidden="true" />
        Ringkasan
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-[#0077A8] ring-1 ring-sky-100">
            <FontAwesomeIcon icon={icon} className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00A8E8]">
              Divisi · {divisiNama}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#1E3A5F]">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
