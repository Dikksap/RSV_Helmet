import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

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
    <header className="space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#00A8E8] sm:text-[11px]">
            <FontAwesomeIcon icon={icon} className="h-3 w-3" aria-hidden="true" />
            Divisi · {divisiNama}
          </p>
          <h1 className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-[#1E3A5F] sm:mt-1 sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B7280] sm:line-clamp-none sm:text-sm">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
