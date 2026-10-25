/**
 * Class utility untuk styling label form agar seragam.
 */
export const labelCls =
  "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700";

/**
 * Class utility untuk styling kontrol input (input text, select, date, textarea).
 */
export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-150 focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:text-sm";

/**
 * Komponen indikator bidang wajib diisi (asterisk merah).
 */
export const req = (
  <span className="ml-0.5 font-bold text-[#E30613]" aria-hidden="true">
    *
  </span>
);