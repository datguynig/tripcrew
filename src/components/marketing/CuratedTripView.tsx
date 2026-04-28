import Image from "next/image";
import Link from "next/link";

import type { CuratedTrip } from "@/lib/marketing/curatedTrips";

const CATEGORY_LABEL: Record<string, string> = {
  flights: "Flights",
  stay: "Stay",
  dinner: "Dinner",
  activity: "Activity",
  transport: "Transport",
};

export function CuratedTripView({ trip }: { trip: CuratedTrip }) {
  return (
    <main className="bg-cream text-ink">
      <Header trip={trip} />
      <SpecBlock trip={trip} />
      <ScheduleBlock trip={trip} />
      <StaysBlock trip={trip} />
      <FlightsBlock trip={trip} />
      <BookingsBlock trip={trip} />
      <ApplyBlock trip={trip} />
    </main>
  );
}

function Header({ trip }: { trip: CuratedTrip }) {
  return (
    <header className="relative bg-ink text-cream overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={trip.heroPhotoUrl}
          alt={`${trip.city}, ${trip.country}`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      </div>

      <div className="relative mx-auto max-w-[1100px] px-6 sm:px-10 pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-44 lg:pb-32">
        <Link
          href="/#curated-trips"
          className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/75 hover:text-cream underline-offset-4 hover:underline"
        >
          ← All curated trips
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="w-[8px] h-[8px] bg-marketing-coral animate-pulse"
          />
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral">
            Curated · Tripcrew plan
          </p>
        </div>

        <p className="mt-6 font-mono uppercase tracking-[0.18em] text-[11px] text-cream/85">
          {trip.country}
        </p>
        <h1 className="mt-3 font-serif font-medium leading-[0.92] tracking-[-0.035em] text-[64px] sm:text-[96px] lg:text-[120px] text-cream">
          {trip.city}
        </h1>
        <p className="mt-5 font-serif italic text-[20px] sm:text-[26px] leading-[1.25] text-cream/90 max-w-[36ch]">
          {trip.tagline}
        </p>
        <p className="mt-8 font-mono uppercase tracking-[0.18em] text-[10px] text-cream/70">
          Photo ·{" "}
          <a
            href={trip.heroPhotoCredit.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-cream/90 hover:underline"
          >
            {trip.heroPhotoCredit.name} on Unsplash
          </a>
        </p>
      </div>
    </header>
  );
}

function SpecBlock({ trip }: { trip: CuratedTrip }) {
  return (
    <section className="border-y-2 border-ink">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-14 md:py-20">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep mb-8">
          The plan, at a glance
        </p>
        <dl className="grid grid-cols-2 md:grid-cols-4 border-2 border-ink">
          {trip.specCells.map((cell, i) => (
            <div
              key={cell.label}
              className={[
                "p-6 md:p-7 flex flex-col gap-2",
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
              <dd className="font-serif text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em]">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
          {trip.datesLabel} · {trip.totalDays} days · {trip.crewLabel}
        </p>
      </div>
    </section>
  );
}

function ScheduleBlock({ trip }: { trip: CuratedTrip }) {
  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28">
        <div className="flex flex-col gap-3 mb-12 max-w-[640px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Schedule · day by day
          </p>
          <h2 className="font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-[-0.025em]">
            {trip.totalDays} days, drafted around the vibes.
          </h2>
        </div>

        <ol className="flex flex-col">
          {trip.fullSchedule.map((row, i) => {
            const isLast = i === trip.fullSchedule.length - 1;
            return (
              <li
                key={`${row.day}-${i}`}
                className={`grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 md:gap-10 py-6 md:py-8 ${
                  isLast ? "" : "border-b border-ink/10"
                }`}
              >
                <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 md:pt-1">
                  {row.day}
                </p>
                <div className="flex flex-col gap-2.5">
                  <p className="font-serif text-[22px] md:text-[26px] leading-[1.15] tracking-[-0.015em]">
                    {row.place}
                  </p>
                  <p className="text-[15px] md:text-[16px] leading-[1.6] text-ink/80 max-w-[68ch]">
                    {row.note}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function StaysBlock({ trip }: { trip: CuratedTrip }) {
  if (trip.stays.length === 0) return null;
  return (
    <section className="bg-cream border-y-2 border-ink">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28">
        <div className="flex flex-col gap-3 mb-12 max-w-[640px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Where the crew stays
          </p>
          <h2 className="font-serif text-[36px] md:text-[44px] leading-[1.02] tracking-[-0.025em]">
            One villa. Six beds. No solo rooms.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink border-2 border-ink">
          {trip.stays.map((stay) => (
            <article
              key={stay.name}
              className="bg-cream flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={stay.photoUrl}
                  alt={stay.name}
                  fill
                  sizes="(min-width: 768px) 540px, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6 md:p-8 flex flex-col gap-3">
                <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                  {stay.neighbourhood}
                </p>
                <h3 className="font-serif text-[26px] leading-[1.1] tracking-[-0.015em]">
                  {stay.name}
                </h3>
                <div className="flex items-center gap-4 mt-2">
                  <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
                    {stay.pricePerNight} / night
                  </p>
                  <span aria-hidden="true" className="text-ink/30">·</span>
                  <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70">
                    ★ {stay.rating}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {trip.stays.length === 1 ? (
            <div className="bg-cream p-8 md:p-10 flex flex-col justify-center gap-5">
              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
                Your version
              </p>
              <p className="font-serif text-[22px] md:text-[26px] leading-[1.15] tracking-[-0.015em] max-w-[28ch]">
                Apply once. The AI swaps in stays sized to your crew and budget.
              </p>
              <p className="text-[14px] leading-[1.55] text-ink/70 max-w-[36ch]">
                Single rooms, twin shares, dog-friendly, gym in the building. Tell us, the AI picks.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FlightsBlock({ trip }: { trip: CuratedTrip }) {
  if (trip.flights.length === 0) return null;
  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28">
        <div className="flex flex-col gap-3 mb-12 max-w-[640px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Live flight prices
          </p>
          <h2 className="font-serif text-[36px] md:text-[44px] leading-[1.02] tracking-[-0.025em]">
            Real fares, refreshed on demand.
          </h2>
        </div>

        <div className="border-2 border-ink">
          {trip.flights.map((flight, i) => {
            const isLast = i === trip.flights.length - 1;
            return (
              <div
                key={`${flight.carrier}-${flight.route}`}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-4 sm:gap-6 px-5 sm:px-7 py-5 sm:py-6 ${
                  isLast ? "" : "border-b-2 border-ink/15"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <p className="font-serif text-[20px] sm:text-[22px] leading-[1.1] tracking-[-0.01em]">
                    {flight.carrier}
                  </p>
                  <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                    {flight.route}
                  </p>
                </div>
                <p className="hidden sm:block font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70">
                  {flight.duration}
                </p>
                <p className="hidden sm:block font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70">
                  return
                </p>
                <p className="font-serif text-[24px] sm:text-[28px] leading-none tracking-[-0.015em] text-marketing-coral-deep">
                  {flight.pricePerHead}
                  <span className="font-mono text-[10px] tracking-[0.18em] text-ink/65 ml-1.5 align-middle">
                    pp
                  </span>
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-5 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
          Snapshot · Crew Plus refreshes prices live for your dates
        </p>
      </div>
    </section>
  );
}

function BookingsBlock({ trip }: { trip: CuratedTrip }) {
  return (
    <section className="bg-cream border-y-2 border-ink">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28">
        <div className="flex flex-col gap-3 mb-12 max-w-[640px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Bookings · the crew checklist
          </p>
          <h2 className="font-serif text-[36px] md:text-[44px] leading-[1.02] tracking-[-0.025em]">
            Everything to lock. One shared list.
          </h2>
        </div>

        <ul className="border-2 border-ink bg-cream">
          {trip.bookings.map((booking, i) => {
            const isLast = i === trip.bookings.length - 1;
            return (
              <li
                key={`${booking.label}-${i}`}
                className={`grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr_auto] items-start gap-4 sm:gap-6 px-5 sm:px-7 py-5 sm:py-6 ${
                  isLast ? "" : "border-b border-ink/10"
                }`}
              >
                <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 pt-1">
                  {CATEGORY_LABEL[booking.category] ?? booking.category}
                </p>
                <p className="font-serif text-[18px] sm:text-[20px] leading-[1.25] tracking-[-0.005em]">
                  {booking.label}
                </p>
                <p className="col-span-2 sm:col-span-1 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 sm:text-right sm:max-w-[24ch]">
                  {booking.detail}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ApplyBlock({ trip }: { trip: CuratedTrip }) {
  return (
    <section className="bg-ink text-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-24 md:py-32">
        <div className="flex flex-col items-center text-center gap-8">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral">
            Make it yours
          </p>
          <h2 className="font-serif text-[40px] md:text-[64px] leading-[1.02] tracking-[-0.025em] max-w-[20ch]">
            Apply once. The AI plans your version.
          </h2>
          <p className="text-[16px] sm:text-[18px] leading-[1.55] text-cream/75 max-w-[52ch]">
            Same {trip.city} energy, scaled to your crew. Different dates, different
            budget, different vibes. The AI redrafts the whole plan around what
            you actually want.
          </p>
          <div className="mt-2 flex flex-col sm:flex-row items-center gap-5">
            <Link
              href={`/apply?intent=plus&seed=${trip.slug}&vibes=${trip.applyVibes}`}
              className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-marketing-coral hover:bg-cream hover:border-cream transition-colors duration-150 whitespace-nowrap"
            >
              Apply for a {trip.city} plan →
            </Link>
            <Link
              href="/#curated-trips"
              className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/70 hover:text-cream underline-offset-4 hover:underline"
            >
              ↓ Browse other curated plans
            </Link>
          </div>
          <p className="mt-4 font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55 max-w-[52ch]">
            Crew Plus · £9 / mo · one admin pays, the whole crew gets in.
          </p>
        </div>
      </div>
    </section>
  );
}
