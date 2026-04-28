import type { CuratedTrip } from "@/lib/marketing/curatedTrips";

/**
 * Four-cell horizontal strip showing the curated trip's default values.
 * Shown in the gate state to anchor expectations ("this is the trip's
 * typical shape") without claiming any of these numbers belong to the
 * visitor — that's what the form does.
 */
export function TypicalSpecStrip({ trip }: { trip: CuratedTrip }) {
  const originCell =
    trip.specCells.find((c) => c.label === "From")?.value ?? trip.origin;
  const crewValue = trip.crewLabel.replace(/\s*crew\s*$/i, "").trim() ||
    trip.crewLabel;

  const cells = [
    {
      label: "Per head",
      value: `~£${trip.perHeadAmount.toLocaleString("en-GB")}`,
    },
    { label: "Crew", value: `${crewValue} crew` },
    { label: "Days", value: `${trip.totalDays} days` },
    { label: "Origin", value: originCell },
  ];

  return (
    <section className="border-y-2 border-ink bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-12 md:py-16">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep mb-7">
          <span
            aria-hidden="true"
            className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
          />
          Typical · the trip&rsquo;s default shape
        </p>

        <dl className="grid grid-cols-2 md:grid-cols-4 border-2 border-ink">
          {cells.map((cell, i) => (
            <div
              key={cell.label}
              className={[
                "p-5 md:p-6 flex flex-col gap-2",
                i % 2 === 1 ? "border-l-2 border-ink/15" : "",
                i >= 2 ? "border-t-2 border-ink/15 md:border-t-0" : "",
                i === 2 ? "md:border-l-2 md:border-ink/15" : "",
                i === 3 ? "md:border-l-2 md:border-ink/15" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                {cell.label}
              </dt>
              <dd className="font-serif text-[24px] md:text-[30px] leading-[1.1] tracking-[-0.02em]">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
          Your version, scaled to your crew, comes after the form ↓
        </p>
      </div>
    </section>
  );
}
