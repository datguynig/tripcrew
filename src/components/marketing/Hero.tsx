import Link from "next/link";

import {
  AnimatedHeadline,
  AnimatedSubhead,
  HeroBackdrop,
  HeroCTAGroup,
  HeroEyebrow,
  HeroFeaturedReveal,
  HeroFootnote,
  KenBurnsImage,
} from "@/components/marketing/HeroMotion";
import type { CuratedTrip } from "@/lib/marketing/curatedTrips";

type HeroProps = {
  applicantCount: number;
  featuredTrip: CuratedTrip;
  foundingRemaining: number;
};

export function Hero({
  applicantCount,
  featuredTrip,
  foundingRemaining,
}: HeroProps) {
  const claimed = Math.max(0, 500 - foundingRemaining);

  return (
    <section className="relative overflow-hidden bg-cream text-ink">
      <HeroBackdrop />

      <div className="relative mx-auto max-w-[1100px] px-6 sm:px-10 pt-20 pb-24 sm:pt-28 lg:pt-36 lg:pb-32">
        <div className="flex flex-col items-center text-center">
          <HeroEyebrow className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Invite-only · Cohort 01
          </HeroEyebrow>

          <AnimatedHeadline className="mt-8 font-serif font-medium leading-[0.95] tracking-[-0.035em] text-[56px] sm:text-[80px] lg:text-[104px] max-w-[14ch]" />

          <AnimatedSubhead className="mt-8 max-w-[44ch] text-[19px] leading-[1.5] text-ink/75 sm:text-[22px]" />

          <HeroCTAGroup className="mt-10 flex flex-col sm:flex-row items-center gap-5">
            <Link
              href="/apply"
              className="group inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-ink hover:bg-marketing-coral hover:text-ink hover:border-marketing-coral transition-colors duration-150 whitespace-nowrap"
            >
              Apply for an invite
              <span
                aria-hidden="true"
                className="ml-2 inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
            <a
              href="#featured-plan"
              className="group font-mono uppercase tracking-[0.18em] text-[11px] text-ink/65 hover:text-ink underline-offset-4 hover:underline"
            >
              <span
                aria-hidden="true"
                className="inline-block mr-1 transition-transform duration-200 ease-out group-hover:translate-y-[2px]"
              >
                ↓
              </span>
              See a curated plan
            </a>
          </HeroCTAGroup>

          <HeroFootnote className="mt-7 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
            {claimed > 0
              ? `${claimed.toLocaleString("en-GB")} / 500 founding spots claimed`
              : "500 founding spots open"}
            {applicantCount > 0
              ? ` · ${applicantCount.toLocaleString("en-GB")} on the waitlist`
              : ""}
          </HeroFootnote>
        </div>

        <div id="featured-plan" className="mt-20 sm:mt-24">
          <HeroFeaturedReveal>
            <FeaturedTripPlan trip={featuredTrip} />
          </HeroFeaturedReveal>
        </div>
      </div>
    </section>
  );
}

function FeaturedTripPlan({ trip }: { trip: CuratedTrip }) {
  const previewDays = trip.fullSchedule.slice(0, 3);

  return (
    <article className="mx-auto max-w-[940px] border-2 border-ink bg-cream shadow-[8px_8px_0_0_rgba(26,22,20,0.08)]">
      <div className="relative aspect-[16/9] overflow-hidden border-b-2 border-ink">
        <KenBurnsImage
          src={trip.heroPhotoUrl}
          alt={`${trip.city}, ${trip.country}`}
          fill
          sizes="(min-width: 1024px) 940px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />

        <div className="absolute top-5 left-5 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="w-[8px] h-[8px] bg-marketing-coral animate-pulse"
          />
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream">
            Tripcrew plan · curated
          </p>
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3">
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/85">
            {trip.country}
          </p>
          <h2 className="font-serif text-[44px] sm:text-[56px] lg:text-[64px] leading-[0.95] tracking-[-0.025em] text-cream">
            {trip.city}
          </h2>
          <p className="font-serif italic text-[16px] sm:text-[18px] leading-[1.3] text-cream/90 max-w-[42ch]">
            {trip.tagline}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 border-b-2 border-ink">
        {trip.specCells.map((cell, i) => (
          <div
            key={cell.label}
            className={[
              "px-5 py-5 sm:px-6 sm:py-6 flex flex-col gap-2",
              i % 2 === 1 ? "border-l-2 border-ink/15" : "",
              i >= 2 ? "border-t-2 border-ink/15 sm:border-t-0" : "",
              i === 2 ? "sm:border-l-2 sm:border-ink/15" : "",
              i === 3 ? "sm:border-l-2 sm:border-ink/15" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <dt className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65">
              {cell.label}
            </dt>
            <dd className="font-serif text-[22px] sm:text-[26px] leading-[1.1] tracking-[-0.015em] truncate">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-6 sm:px-9 py-9 sm:py-11 flex flex-col gap-7">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
            Schedule · first 3 of {trip.totalDays} days
          </p>
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-marketing-coral-deep">
            {trip.datesLabel}
          </p>
        </div>

        <ol className="flex flex-col gap-5">
          {previewDays.map((row, i) => (
            <li
              key={`${row.day}-${i}`}
              className="pl-5 border-l-2 border-marketing-coral"
            >
              <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 mb-1.5">
                {row.day} · {row.place}
              </p>
              <p className="text-[15px] sm:text-[16px] leading-[1.55] text-ink/85 max-w-[64ch]">
                {row.note}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t-2 border-ink/10">
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 max-w-[36ch]">
            {trip.totalDays - 3} more days · stays · bookings · in the full plan
          </p>
          <Link
            href={`/curated/${trip.slug}`}
            className="group inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[11px] h-[48px] px-6 border-2 border-marketing-coral hover:bg-ink hover:text-cream hover:border-ink transition-colors duration-150 whitespace-nowrap self-start"
          >
            See the full {trip.city} plan
            <span
              aria-hidden="true"
              className="ml-2 inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
