import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CuratedTripGateView } from "@/components/marketing/curated/CuratedTripGateView";
import { CuratedTripPersonalisedView } from "@/components/marketing/curated/CuratedTripPersonalisedView";
import {
  readDraftFromCookie,
  validateResumeToken,
} from "@/lib/actions/draftLeadResume";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);
  if (!trip) return { title: "Tripcrew — curated trip" };
  return {
    title: `${trip.city} · Tripcrew curated`,
    description: `${trip.tagline} See your version of ${trip.city}: origin, crew, dates, budget personalised.`,
  };
}

export default async function CuratedTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ resume?: string; token?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const trip = getCuratedTripBySlug(slug);

  if (!trip) notFound();

  // Reset is handled by /api/teaser/reset (Route Handler) which clears
  // the draft cookie and 302s back to /curated/[slug]. Cookies can't be
  // mutated inside Server Components in Next.js 16, so this page only
  // reads them.

  if (sp.resume && sp.token) {
    const draft = await validateResumeToken(sp.resume, sp.token, slug);
    if (draft && draft.teaser) {
      return (
        <CuratedTripPersonalisedView
          trip={trip}
          draft={{ ...draft, teaser: draft.teaser }}
        />
      );
    }
  }

  const draft = await readDraftFromCookie(slug);
  if (draft && draft.teaser) {
    return (
      <CuratedTripPersonalisedView
        trip={trip}
        draft={{ ...draft, teaser: draft.teaser }}
      />
    );
  }

  return <CuratedTripGateView trip={trip} />;
}
