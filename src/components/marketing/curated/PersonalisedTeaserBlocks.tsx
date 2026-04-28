import { Fragment } from "react";

import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import type { TeaserOutput } from "@/lib/types";

type PersonalisedTeaserBlocksProps = {
  teaser: TeaserOutput;
  trip: CuratedTrip;
};

/**
 * Renders the four personalised teaser sections in sequence, then the
 * draft-preview watermark. Calibration is fixed: 2 of N day samples,
 * 1 stay (neighbourhood + price band, no name), 1 flight price band
 * (no carrier), bookings count only. Specifics that would let the
 * visitor extract a usable plan stay gated behind /apply.
 */
export function PersonalisedTeaserBlocks({
  teaser,
  trip,
}: PersonalisedTeaserBlocksProps) {
  const remaining = Math.max(0, trip.totalDays - teaser.days.length);

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28 flex flex-col gap-20 md:gap-24">
        <HeroParagraphBlock paragraph={teaser.hero_paragraph} />
        <ScheduleSampleBlock days={teaser.days} remaining={remaining} />
        <StayAndFlightsBlock stay={teaser.stay} flights={teaser.flights} />
        <BookingsCountBlock count={teaser.bookings_count} />
        <Watermark />
      </div>
    </section>
  );
}

function HeroParagraphBlock({ paragraph }: { paragraph: string }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
        <span
          aria-hidden="true"
          className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
        />
        Your trip · sketched
      </p>
      <p className="font-serif text-[24px] sm:text-[30px] md:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink max-w-[34ch] md:max-w-[40ch]">
        {renderHeroParagraph(paragraph)}
      </p>
    </div>
  );
}

function ScheduleSampleBlock({
  days,
  remaining,
}: {
  days: TeaserOutput["days"];
  remaining: number;
}) {
  return (
    <div className="flex flex-col gap-7">
      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
        <span
          aria-hidden="true"
          className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
        />
        Your version · sketched
      </p>

      <ol className="flex flex-col">
        {days.map((row, i) => {
          const isLast = i === days.length - 1;
          return (
            <li
              key={`${row.day}-${i}`}
              className={`grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 md:gap-10 py-6 md:py-8 ${
                isLast ? "" : "border-b border-ink/10"
              }`}
            >
              <div className="flex flex-col gap-1">
                <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                  {row.day}
                </p>
                <p className="font-serif text-[20px] md:text-[24px] leading-[1.15] tracking-[-0.015em]">
                  {row.place}
                </p>
              </div>
              <p className="text-[15px] md:text-[16px] leading-[1.6] text-ink/80 max-w-[60ch] md:pt-1">
                {row.note}
              </p>
            </li>
          );
        })}
      </ol>

      {remaining > 0 ? (
        <p className="font-serif italic text-[20px] md:text-[24px] leading-[1.3] tracking-[-0.01em] text-ink/70 pt-2">
          + {remaining} more {remaining === 1 ? "day" : "days"}, in your full plan.
        </p>
      ) : null}
    </div>
  );
}

function StayAndFlightsBlock({
  stay,
  flights,
}: {
  stay: TeaserOutput["stay"];
  flights: TeaserOutput["flights"];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink/15 border-2 border-ink">
      <div className="bg-cream p-7 md:p-9 flex flex-col gap-3">
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
          Where you&rsquo;d stay
        </p>
        <p className="font-serif text-[28px] md:text-[34px] leading-[1.05] tracking-[-0.02em]">
          {stay.neighbourhood}
        </p>
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/80 mt-1">
          {stay.priceBand}
        </p>
      </div>
      <div className="bg-cream p-7 md:p-9 flex flex-col gap-3">
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
          How you&rsquo;d get there
        </p>
        <p className="font-serif text-[28px] md:text-[34px] leading-[1.05] tracking-[-0.02em]">
          Flights
        </p>
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/80 mt-1">
          {flights.priceBand}
        </p>
      </div>
    </div>
  );
}

function BookingsCountBlock({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
        <span
          aria-hidden="true"
          className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
        />
        What&rsquo;s locked in your full plan
      </p>
      <p className="font-serif text-[24px] md:text-[30px] leading-[1.2] tracking-[-0.02em] text-ink max-w-[44ch]">
        {count} things to book. Flights, stays, dinners, activities.
      </p>
    </div>
  );
}

function Watermark() {
  return (
    <div className="flex items-center gap-3 pt-4 border-t-2 border-ink/15">
      <span
        aria-hidden="true"
        className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep"
      />
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] sm:text-[11px] text-marketing-coral-deep">
        Draft preview · apply to unlock + book with your crew
      </p>
    </div>
  );
}

// Render the hero paragraph and italicise British-format date ranges
// (e.g. "14–20 June", "14-20 June", "1 to 7 September") so the dates
// the visitor picked feel deliberately set, not boilerplate. Only the
// first match per paragraph is italicised — the AI may write follow-on
// month references that shouldn't all turn into italic emphasis.
const DATE_RANGE_RE =
  /\b(\d{1,2}\s*(?:[–\-—]|to)\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))\b/i;

function renderHeroParagraph(paragraph: string) {
  const match = paragraph.match(DATE_RANGE_RE);
  if (!match || match.index === undefined) {
    return paragraph;
  }
  const before = paragraph.slice(0, match.index);
  const dates = match[0];
  const after = paragraph.slice(match.index + dates.length);
  return (
    <Fragment>
      {before}
      <em className="font-serif italic">{dates}</em>
      {after}
    </Fragment>
  );
}
