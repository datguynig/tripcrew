type Cell = { label: string; value: string; sub: string };

export function SpecGrid({
  cells,
  isAdmin,
  tripSlug,
}: {
  cells: Cell[];
  isAdmin?: boolean;
  tripSlug?: string;
}) {
  if (cells.length === 0) {
    return (
      <div className="border border-line py-14 text-center mb-9">
        <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          {isAdmin
            ? "Spec grid empty"
            : "Spec grid · details coming soon"}
        </div>
        {isAdmin && tripSlug && (
          <a
            href={`/trips/${tripSlug}/admin`}
            className="inline-block mt-3 font-mono text-[11px] tracking-[0.1em] uppercase text-accent hover:text-fg transition-colors"
          >
            Set it in admin →
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 border border-line mb-9">
      {cells.map((cell, i) => (
        <div
          key={`${cell.label}-${i}`}
          className={`py-[22px] px-6 border-r border-b border-line ${
            i % 4 === 3 ? "border-r-0" : ""
          } ${i >= cells.length - (cells.length % 4 || 4) ? "last:border-b-0" : ""} max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-last-child(-n+2)]:border-b-0 max-[520px]:border-r-0 max-[520px]:last:border-b-0`}
        >
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-3">
            {cell.label}
          </div>
          <div className="text-[22px] font-medium tracking-[-0.02em] leading-[1.15]">
            {cell.value}
          </div>
          <div className="text-[13px] text-fg-2 mt-1.5">{cell.sub}</div>
        </div>
      ))}
    </div>
  );
}
