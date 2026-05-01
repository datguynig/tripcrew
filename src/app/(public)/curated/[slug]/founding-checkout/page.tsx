import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { FoundingCheckoutHold } from "@/components/marketing/curated/FoundingCheckoutHold";
import { claimFoundingSeat } from "@/lib/actions/foundingReservation";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";
import { createServiceClient } from "@/lib/supabase/server";
import { DRAFT_COOKIE_NAME } from "@/lib/teaser/cookieConfig";
import type { DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Founding spot · Tripcrew",
  description: "Your founding spot is on hold. Pay £179 / year, price-locked for life.",
};

type FoundingReservationRow = {
  id: string;
  expires_at: string;
  consumed: boolean;
};

export default async function FoundingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ draft?: string; token?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const trip = getCuratedTripBySlug(slug);

  if (!trip) redirect(`/`);
  if (!sp.draft) redirect(`/curated/${slug}`);

  const supabase = createServiceClient();
  const { data: draft } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", sp.draft)
    .eq("slug", slug)
    .maybeSingle<DraftLead>();

  if (!draft) redirect(`/curated/${slug}`);

  // Ownership: cookie matches OR token query param matches the draft's
  // resume_token. Either gate is enough — the cookie covers same-browser
  // visitors who clicked through from the personalised view, the token
  // covers visitors arriving from the email nudge.
  const cookieStore = await cookies();
  const cookieDraftId = cookieStore.get(DRAFT_COOKIE_NAME)?.value;
  const cookieMatch = cookieDraftId === draft.id;
  const tokenMatch = !!sp.token && sp.token === draft.resume_token;

  if (!cookieMatch && !tokenMatch) {
    return <CannotFindDraftState slug={slug} city={trip.city} />;
  }

  const { data: existingHold } = await supabase
    .from("founding_reservations")
    .select("id, expires_at, consumed")
    .eq("draft_lead_id", draft.id)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle<FoundingReservationRow>();

  let reservation: FoundingReservationRow | null = existingHold ?? null;

  if (!reservation) {
    const claim = await claimFoundingSeat(draft.id);
    if (!claim.ok) {
      if (claim.error === "invalid_draft") redirect(`/curated/${slug}`);
      if (claim.error === "sold_out") return <SoldOutState />;
      return <InternalErrorState slug={slug} />;
    }

    const { data: fresh } = await supabase
      .from("founding_reservations")
      .select("id, expires_at, consumed")
      .eq("id", claim.reservationId)
      .maybeSingle<FoundingReservationRow>();
    reservation = fresh ?? null;
  }

  if (!reservation || reservation.consumed) {
    return <InternalErrorState slug={slug} />;
  }

  return (
    <FoundingCheckoutHold
      reservationId={reservation.id}
      expiresAt={reservation.expires_at}
      draft={draft}
      trip={trip}
    />
  );
}

function SoldOutState() {
  return (
    <main className="min-h-screen bg-cream text-ink flex items-center">
      <div className="mx-auto max-w-[760px] w-full px-6 sm:px-10 py-24">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-[8px] h-[8px] bg-marketing-coral" />
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Founding cohort · Closed
          </p>
        </div>
        <h1 className="mt-6 font-serif font-medium leading-[0.95] tracking-[-0.035em] text-[44px] sm:text-[64px] text-ink max-w-[18ch]">
          All 500 founding spots are taken.
        </h1>
        <p className="mt-5 font-serif italic text-[19px] sm:text-[22px] leading-[1.35] text-ink/75 max-w-[44ch]">
          Pioneer spots are filled. Member opens up shortly after. Apply
          to join the next wave at the standard price.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral hover:text-ink transition-colors duration-150"
          >
            Browse curated trips →
          </Link>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center bg-transparent text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-ink hover:bg-ink hover:text-cream transition-colors duration-150"
          >
            Apply to Yenkoh →
          </Link>
        </div>
      </div>
    </main>
  );
}

function CannotFindDraftState({ slug, city }: { slug: string; city: string }) {
  return (
    <main className="min-h-screen bg-cream text-ink flex items-center">
      <div className="mx-auto max-w-[760px] w-full px-6 sm:px-10 py-24">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-[8px] h-[8px] bg-marketing-coral" />
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Hold check · No match
          </p>
        </div>
        <h1 className="mt-6 font-serif font-medium leading-[0.95] tracking-[-0.035em] text-[44px] sm:text-[60px] text-ink max-w-[20ch]">
          Can&rsquo;t find your draft.
        </h1>
        <p className="mt-5 font-serif italic text-[19px] sm:text-[22px] leading-[1.35] text-ink/75 max-w-[48ch]">
          The link looks expired or was opened in a different browser. Open the
          email link from your inbox, or start fresh on the {city} preview.
        </p>
        <div className="mt-10">
          <Link
            href={`/curated/${slug}`}
            className="inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral hover:text-ink transition-colors duration-150"
          >
            Back to {city} →
          </Link>
        </div>
      </div>
    </main>
  );
}

function InternalErrorState({ slug }: { slug: string }) {
  return (
    <main className="min-h-screen bg-cream text-ink flex items-center">
      <div className="mx-auto max-w-[760px] w-full px-6 sm:px-10 py-24">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-[8px] h-[8px] bg-marketing-coral" />
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Hold · Failed
          </p>
        </div>
        <h1 className="mt-6 font-serif font-medium leading-[0.95] tracking-[-0.035em] text-[44px] sm:text-[60px] text-ink max-w-[20ch]">
          Something went wrong holding your spot.
        </h1>
        <p className="mt-5 font-serif italic text-[19px] sm:text-[22px] leading-[1.35] text-ink/75 max-w-[48ch]">
          No charge made. Head back to the trip page and try again.
        </p>
        <div className="mt-10">
          <Link
            href={`/curated/${slug}`}
            className="inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral hover:text-ink transition-colors duration-150"
          >
            Try again →
          </Link>
        </div>
      </div>
    </main>
  );
}
