export function Section({
  no,
  title,
  subtitle,
  children,
}: {
  no: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="mb-5 flex items-start gap-4 border-b border-[#E5E5E5] pb-4">
        <span className="text-[2rem] font-black leading-none tracking-tight text-[#E30613]">
          {no}
        </span>
        <span className="border-l-2 border-[#E30613] pl-4">
          <h2 className="text-[1.05rem] font-extrabold uppercase tracking-wide text-[#0B0B0B]">
            {title}
          </h2>
          <p className="mt-0.5 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-[#A3A3A3]">
            {subtitle}
          </p>
        </span>
      </div>
      {children}
    </section>
  );
}
