import Image from "next/image";
import Link from "next/link";

import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import type { DraftLead, TeaserOutput } from "@/lib/types";

import { ConversionCTAs } from "./ConversionCTAs";
import { PersonalisedSpecGrid } from "./PersonalisedSpecGrid";
import { PersonalisedTeaserBlocks } from "./PersonalisedTeaserBlocks";

type DraftWithTeaser = DraftLead & { teaser: TeaserOutput };

type CuratedTripPersonalisedViewProps = {
  trip: CuratedTrip;
  draft: DraftWithTeaser;
};

/**
 * Post-submit ("personalised") render of a curated trip page. Wraps
 * the same hero treatment as the gate view, then swaps the form
 * section for the visitor's spec grid + teaser blocks + CTAs. The
 * "← Change inputs ↺" affordance under the hero hands control back to
 * the gate view by hitting /curated/[slug]?reset=1.
 */
export function CuratedTripPersonalisedView({
  trip,
  draft,
}: CuratedTripPersonalisedViewProps) {
  return (
    <main className="bg-cream text-ink">
      <PersonalisedHeader trip={trip} slug={trip.slug} />
      <PersonalisedSpecGrid spec={draft.teaser.spec} inputs={draft.inputs} />
      <PersonalisedTeaserBlocks teaser={draft.teaser} trip={trip} />
      <ConversionCTAs draftId={draft.id} slug={trip.slug} />
    </main>
  );
}

function PersonalisedHeader({
  trip,
  slug,
}: {
  trip: CuratedTrip;
  slug: string;
}) {
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

      <div className="relative border-t-2 border-cream/15 bg-ink">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
          <a
            href={`/api/teaser/reset?slug=${encodeURIComponent(slug)}`}
            className="font-mono uppercase tracking-[0.18em] text-[10px] sm:text-[11px] text-cream/70 hover:text-cream underline-offset-4 hover:underline"
          >
            ← Change inputs ↺
          </a>
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-marketing-coral">
            Draft preview
          </p>
        </div>
      </div>
    </header>
  );
}
