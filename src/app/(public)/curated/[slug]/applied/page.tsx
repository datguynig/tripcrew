import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkipTheQueueUpsell } from "@/components/marketing/curated/SkipTheQueueUpsell";
import { createServiceClient } from "@/lib/supabase/server";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);
  return {
    title: trip
      ? `Application received · ${trip.city} · Tripcrew`
      : "Application received · Tripcrew",
  };
}

type ApplicationLookup = {
  id: string;
  draft_lead_id: string | null;
};

async function lookupApplication(
  applicationId: string,
): Promise<ApplicationLookup | null> {
  if (!UUID_RE.test(applicationId)) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, draft_lead_id")
    .eq("id", applicationId)
    .maybeSingle<ApplicationLookup>();
  if (error || !data) return null;
  return data;
}

export default async function CuratedAppliedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ application?: string | string[] }>;
}) {
  const { slug } = await params;
  const { application: rawApp } = await searchParams;

  const trip = getCuratedTripBySlug(slug);
  if (!trip) notFound();

  const applicationId = Array.isArray(rawApp) ? rawApp[0] : rawApp;
  const application = applicationId
    ? await lookupApplication(applicationId)
    : null;

  return (
    <main className="min-h-screen w-full bg-cream text-ink">
      <div className="mx-auto w-full max-w-[820px] px-6 sm:px-10 pt-24 pb-32 md:pt-36 md:pb-40">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep"
          />
          <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral-deep">
            Application received
          </p>
        </div>

        <h1 className="mt-8 font-serif font-medium text-[44px] sm:text-[56px] md:text-[64px] leading-[1.02] tracking-[-0.03em] text-ink text-balance">
          You&rsquo;ll hear within seven days.
        </h1>

        <p className="mt-8 max-w-[58ch] text-[17px] sm:text-[18px] leading-[1.55] text-ink/80 text-pretty">
          We got your Crew Plus application for Cohort 01. We&rsquo;re
          reviewing in weekly batches. Expect a decision in your inbox within
          seven days.
        </p>

        <p className="mt-6 font-mono uppercase tracking-[0.18em] text-[11px] text-ink/60">
          Trip · {trip.city}, {trip.country}
        </p>

        <div className="mt-14 h-px w-full bg-ink/15" aria-hidden="true" />

        <SkipTheQueueUpsell
          slug={slug}
          draftId={application?.draft_lead_id ?? null}
        />
      </div>
    </main>
  );
}
