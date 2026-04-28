import Image from "next/image";
import Link from "next/link";

import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import { TeaserForm } from "./TeaserForm";
import { TypicalSpecStrip } from "./TypicalSpecStrip";

/**
 * Pre-submit ("gate") render of a curated trip page. Hard gate: only
 * hero + typical-spec strip + form are visible. Schedule, stays,
 * flights, and bookings stay hidden until the visitor submits the
 * teaser form and the personalised view takes over.
 */
export function CuratedTripGateView({ trip }: { trip: CuratedTrip }) {
  return (
    <main className="bg-cream text-ink">
      <CuratedTripHeader trip={trip} />
      <TypicalSpecStrip trip={trip} />
      <FormSection trip={trip} />
    </main>
  );
}

function CuratedTripHeader({ trip }: { trip: CuratedTrip }) {
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

function FormSection({ trip }: { trip: CuratedTrip }) {
  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,560px)] gap-12 lg:gap-20">
          <div className="flex flex-col gap-6 max-w-[560px]">
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
              <span
                aria-hidden="true"
                className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
              />
              Make it yours · 60 seconds
            </p>
            <h2 className="font-serif text-[44px] md:text-[60px] leading-[1] tracking-[-0.03em]">
              See <em className="font-serif italic">your</em> {trip.city}.
            </h2>
            <p className="text-[17px] sm:text-[18px] leading-[1.55] text-ink/80 max-w-[44ch]">
              Same {trip.city} energy, scaled to your crew, your dates, your
              budget. The AI redrafts the whole plan around what you actually
              want.
            </p>

            <ul className="mt-2 flex flex-col gap-3">
              {[
                "Real flight estimate from your airport.",
                "Stays sized to your crew and budget.",
                "Two days drafted live, the rest unlocked when you apply.",
              ].map((line) => (
                <li
                  key={line}
                  className="pl-5 border-l-2 border-marketing-coral text-[15px] leading-[1.5] text-ink/85"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-ink bg-cream p-6 sm:p-9 shadow-[8px_8px_0_0_rgba(26,22,20,0.08)]">
            <TeaserForm trip={trip} />
          </div>
        </div>
      </div>
    </section>
  );
}
