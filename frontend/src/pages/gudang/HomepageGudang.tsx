import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";

import { GUDANG_BARANG, GUDANG_PERMINTAAN, GUDANG_WAREHOUSE } from "../../layouts/gudang/navigation";
import { ModuleSection, type HomeSection } from "../../components/HomeTiles";

const SECTIONS: HomeSection[] = [
  { title: GUDANG_BARANG.label, description: "Kelola stok dan mutasi barang gudang", items: GUDANG_BARANG.children },
  { title: GUDANG_WAREHOUSE.label, description: "Kelola item dan opname stok warehouse", items: GUDANG_WAREHOUSE.children },
  { title: GUDANG_PERMINTAAN.label, description: "Kelola permintaan barang masuk", items: GUDANG_PERMINTAAN.children },
];

const totalModules = SECTIONS.reduce((total, section) => total + section.items.length, 0);

function HomepageGudang() {
  return (
    <div className="w-full space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,28,46,0.04)] sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-accent-500/[0.07] blur-2xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-600/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-600">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              Dashboard
            </span>
            <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-navy-900 sm:text-[30px]">
              Beranda warehouse
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-500">
              Kelola stok barang, warehouse, dan permintaan barang dari satu dashboard terpusat.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600">
            <FontAwesomeIcon icon={faBoxesStacked} className="h-3 w-3 text-accent-600" />
            <span className="font-semibold tabular-nums text-slate-700">{totalModules}</span> modul
          </span>
        </div>
      </section>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <ModuleSection key={section.title} {...section} />
        ))}
      </div>
    </div>
  );
}

export default HomepageGudang;
