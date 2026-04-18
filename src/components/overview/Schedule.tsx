import { AIDraftBadge } from "@/components/overview/AIDraftBadge";

type Row = { day_label: string; heading: string; body: string };

export function Schedule({
  rows,
  isAdmin,
  tripSlug,
  aiDrafted = false,
}: {
  rows: Row[];
  isAdmin?: boolean;
  tripSlug?: string;
  aiDrafted?: boolean;
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
    <div>
      {aiDrafted && (
        <div className="flex justify-end mb-2">
          <AIDraftBadge />
        </div>
      )}
      <div className="border border-line">
      {rows.map((row, i) => (
        <div
          key={`${row.day_label}-${i}`}
          className="grid grid-cols-[140px_1fr] max-[520px]:grid-cols-1 border-b border-line last:border-b-0 py-[22px] px-6 gap-5"
        >
          <div className="pt-[3px] max-[520px]:flex max-[520px]:items-baseline max-[520px]:gap-3">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-4 tabular mb-[6px] max-[520px]:mb-0">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent">
              {row.day_label}
            </div>
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
    </div>
  );
}
