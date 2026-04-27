import Link from "next/link";

import type { SampleTrip } from "@/lib/marketing/sampleTrips";

export function SampleTripTile({ trip }: { trip: SampleTrip }) {
  return (
    <section
      id="sample-trip"
      className="w-full bg-ink text-cream py-24 md:py-32 px-6 md:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-12 md:mb-16">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60 mb-5">
            See what the AI actually produces
          </p>
          <h2 className="font-serif text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
            A real trip. Real budget. Real plan. Six friends.{" "}
            {trip.city}. {trip.totalDays} days.
          </h2>
        </header>

        <article className="border-2 border-cream/30 p-8 md:p-12">
          <div className="grid gap-12 md:gap-16 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-10">
              <div>
                <h3 className="font-serif text-[44px] md:text-[56px] leading-none tracking-[-0.03em] mb-4">
                  {trip.city}
                </h3>
                <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60">
                  {trip.datesLabel} · {trip.durationLabel} ·{" "}
                  {trip.vibesPlusLabel}
                </p>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream/15 border border-cream/15">
                {trip.specCells.map((cell) => (
                  <div
                    key={cell.label}
                    className="bg-ink p-4 md:p-5 flex flex-col gap-2"
                  >
                    <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
                      {cell.label}
                    </dt>
                    <dd className="font-serif text-[24px] md:text-[28px] leading-none tracking-[-0.02em]">
                      {cell.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <ol className="flex flex-col gap-5">
                {trip.schedule.map((item) => (
                  <li
                    key={item.day}
                    className="pl-4 border-l-[3px] border-marketing-coral"
                  >
                    <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55 mb-1.5">
                      {item.day} · {item.place}
                    </p>
                    <p className="text-[15px] md:text-[16px] leading-[1.55] text-cream/90">
                      {item.note}
                    </p>
                  </li>
                ))}
                <li className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/35 pt-1">
                  {trip.totalDays - trip.visibleDays} more days · in the full
                  plan
                </li>
              </ol>
            </div>

            <DestinationPanel trip={trip} />
          </div>

          <div className="mt-12 md:mt-16 pt-8 border-t border-cream/15 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
              Shareable · group-chat-ready
            </p>
            <Link
              href={`/sample-trip/${trip.slug}`}
              className="inline-flex items-center justify-center bg-cream text-ink font-mono uppercase tracking-[0.18em] text-[12px] px-7 min-h-[52px] border-2 border-cream hover:bg-transparent hover:text-cream transition-colors duration-150"
            >
              Explore the full trip →
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

// Right-column editorial typography panel. Replaces the previous polaroid
// stack — the empty placeholders read as broken on a marketing page.
// Editorial-brutalist baseline: huge serif destination, mono-cap dates,
// coral rule, then the highlight stack as mono-caps with coral middots.
function DestinationPanel({ trip }: { trip: SampleTrip }) {
  return (
    <div className="hidden md:flex flex-col justify-between border border-cream/20 p-8 min-h-[460px] relative">
      <div className="absolute -top-3 left-6 bg-ink px-2">
        <span className="font-mono uppercase tracking-[0.22em] text-[10px] text-marketing-coral">
          Featured trip
        </span>
      </div>

      <div className="flex flex-col gap-6 mt-6">
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/55">
          Destination
        </p>
        <h4 className="font-serif text-[64px] lg:text-[80px] leading-[0.92] tracking-[-0.04em]">
          {trip.city}
        </h4>
        <div className="h-px w-12 bg-marketing-coral" />
        <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream/70">
          {trip.datesLabel}
        </p>
        <p className="font-sans text-[15px] leading-[1.45] text-cream/80 italic">
          {trip.occasionLine}
        </p>
      </div>

      <ul className="flex flex-col gap-2 mt-8">
        {trip.highlights.map((h) => (
          <li
            key={h}
            className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream/85 flex items-center gap-3"
          >
            <span className="text-marketing-coral">·</span>
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
