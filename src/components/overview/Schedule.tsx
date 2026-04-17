type Row = { day_label: string; heading: string; body: string };

export function Schedule({
  rows,
  isAdmin,
  tripSlug,
}: {
  rows: Row[];
  isAdmin?: boolean;
  tripSlug?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-line py-14 text-center">
        <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          {isAdmin ? "Schedule empty" : "Schedule · details coming soon"}
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
    <div className="border border-line">
      {rows.map((row, i) => (
        <div
          key={`${row.day_label}-${i}`}
          className="grid grid-cols-[140px_1fr] max-[520px]:grid-cols-1 border-b border-line last:border-b-0 py-[22px] px-6 gap-5"
        >
          <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent pt-[3px]">
            {row.day_label}
          </div>
          <div>
            <div className="text-[20px] font-medium tracking-[-0.02em] mb-[6px]">
              {row.heading}
            </div>
            <p className="text-fg-2 text-[14px] leading-[1.55]">{row.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
