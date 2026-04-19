import { AIDraftBadge } from "@/components/overview/AIDraftBadge";
import { AIDraftRail } from "@/components/overview/AIDraftRail";

type Cell = { label: string; value: string; sub: string };

export function SpecGrid({
  cells,
  isAdmin,
  tripSlug,
  aiDrafted = false,
  aiRail,
}: {
  cells: Cell[];
  isAdmin?: boolean;
  tripSlug?: string;
  aiDrafted?: boolean;
  aiRail?: {
    tripId: string;
    destination: string;
    draftedAt: string | null;
    canRedraft: boolean;
    blockedReason: string | null;
  };
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
    <div className="mb-9">
      {aiDrafted && aiRail ? (
        <AIDraftRail
          tripId={aiRail.tripId}
          destination={aiRail.destination}
          surface="spec_grid"
          draftedAt={aiRail.draftedAt}
          isAdmin={!!isAdmin}
          canRedraft={aiRail.canRedraft}
          blockedReason={aiRail.blockedReason}
        />
      ) : aiDrafted ? (
        <div className="flex justify-end mb-2">
          <AIDraftBadge />
        </div>
      ) : null}
      <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 border border-line">
      {cells.map((cell, i) => (
        <div
          key={`${cell.label}-${i}`}
          className={`py-[22px] px-6 border-r border-b border-line ${
            i % 4 === 3 ? "border-r-0" : ""
          } ${i >= cells.length - (cells.length % 4 || 4) ? "last:border-b-0" : ""} max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-last-child(-n+2)]:border-b-0 max-[520px]:border-r-0 max-[520px]:last:border-b-0`}
        >
          <div className="label-sm-wide text-fg-3 mb-3">{cell.label}</div>
          <div className="text-[22px] font-medium tracking-[-0.02em] leading-[1.2]">
            {cell.value}
          </div>
          {cell.sub && (
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3 mt-2">
              {cell.sub}
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
