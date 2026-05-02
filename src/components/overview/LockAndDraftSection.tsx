import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  BasicDraftSchema,
  PersistedEnrichedDraftSchema,
  type Draft,
} from "@/lib/ai/schema";
import type {
  Booking,
  DraftProgress,
  LivePricing,
  ScheduleItem,
  ScheduleItemPlace,
} from "@/lib/types";
import { BasicDraftView } from "./BasicDraftView";
import { DraftingFlow } from "./DraftingFlow";
import { EnrichedDraftView } from "./EnrichedDraftView";
import { LockAndDraftCTA } from "./LockAndDraftCTA";
import { TravelBlock } from "./TravelBlock";

type Props = {
  tripId: string;
  tripSlug?: string;
  userId: string | null;
  isAdmin: boolean;
  isPioneer?: boolean;
  destination: string | null;
  currency: string;
  enrichedDraft: unknown;
  enrichedDraftTier: "basic" | "enriched" | null;
  enrichedDraftGeneratedAt: string | null;
  lastPriceRefreshAt: string | null;
  livePricing?: LivePricing | null;
  briefStale?: boolean;
  draftProgress?: DraftProgress | null;
  scheduleRows?: ScheduleItem[];
  startDate?: string | null;
  endDate?: string | null;
  targetCrewSize?: number | null;
  originIata?: string | null;
  originLabel?: string | null;
  destinationIata?: string | null;
  bookings?: Booking[];
};

function parseDraft(
  raw: unknown,
  tier: "basic" | "enriched" | null,
): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  // Use the permissive read schema so legacy enriched drafts (generated
  // before the Spec B unification pass added `setup`) still render. The
  // strict generation-time schema lives in lockAndDraft.ts.
  const schema = tier === "basic" ? BasicDraftSchema : PersistedEnrichedDraftSchema;
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  // Fall back: try the other schema in case the tier column drifted from
  // the persisted blob.
  const alt = (tier === "basic" ? PersistedEnrichedDraftSchema : BasicDraftSchema).safeParse(raw);
  return alt.success ? alt.data : null;
}

function buildPlacesIndex(
  rows: ScheduleItem[] | undefined,
): Map<string, ScheduleItemPlace> {
  const index = new Map<string, ScheduleItemPlace>();
  if (!rows) return index;
  for (const row of rows) {
    for (const place of row.places ?? []) {
      if (place.place_id && place.maps_url) {
        index.set(place.place_id, place);
      }
    }
  }
  return index;
}

export function LockAndDraftSection({
  tripId,
  tripSlug,
  userId,
  isAdmin,
  isPioneer = false,
  destination,
  currency,
  enrichedDraft,
  enrichedDraftTier,
  enrichedDraftGeneratedAt,
  lastPriceRefreshAt,
  livePricing,
  briefStale = false,
  draftProgress = null,
  scheduleRows,
  startDate = null,
  endDate = null,
  targetCrewSize = null,
  originIata = null,
  originLabel = null,
  destinationIata = null,
  bookings = [],
}: Props) {
  const draft = parseDraft(enrichedDraft, enrichedDraftTier);
  const hasDraft = draft !== null;
  const showStale = hasDraft && briefStale;
  const placesIndex = buildPlacesIndex(scheduleRows);

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 02"
        title="The plan."
        lead={
          hasDraft
            ? "Built from the brief above."
            : "An AI-drafted plan grounded in live places: where to stay, day-by-day itinerary, what to book ahead, and a budget range."
        }
      />

      {showStale && isAdmin && userId && destination && (
        <div className="mb-8 px-5 py-4 border border-accent/40 bg-accent/5 flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:items-start">
          <div className="flex-1 min-w-0">
            <div className="label-sm-wide text-accent mb-1">BRIEF CHANGED</div>
            <p className="text-[13px] text-fg-2 leading-[1.5]">
              The brief above has been edited since this plan was built. Regenerate to bring the plan in line.
            </p>
          </div>
          <LockAndDraftCTA
            tripId={tripId}
            userId={userId}
            destination={destination}
            variant="regenerate"
          />
        </div>
      )}

      {!hasDraft && isAdmin && userId && destination && (
        <DraftingFlow
          tripId={tripId}
          userId={userId}
          destination={destination}
          initialDraftedAt={enrichedDraftGeneratedAt}
          initialProgress={draftProgress}
        />
      )}

      {!hasDraft && !isAdmin && (
        <p className="text-fg-2 text-[14px] leading-[1.55]">
          No plan drafted yet. An admin can run Lock &amp; draft from this page.
        </p>
      )}

      {!hasDraft && isAdmin && !destination && (
        <p className="text-fg-2 text-[14px] leading-[1.55]">
          Lock a destination and trip dates before drafting a plan.
        </p>
      )}

      {hasDraft && draft.tier === "enriched" && (
        <div className="mb-10">
          <TravelBlock
            livePricing={livePricing ?? null}
            isPioneer={isPioneer}
            userId={userId}
            tripId={tripId}
            draftedAt={enrichedDraftGeneratedAt}
            lastPriceRefreshAt={lastPriceRefreshAt}
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            targetCrewSize={targetCrewSize}
            originIata={originIata}
            originLabel={originLabel}
            destinationIata={destinationIata}
          />
        </div>
      )}

      <div className={showStale ? "relative opacity-60" : "relative"}>
        {showStale && (
          <span className="absolute right-0 top-0 z-10 label-sm-wide text-accent border border-accent/40 px-2 py-1 bg-bg">
            STALE
          </span>
        )}

        {draft?.tier === "basic" && (
          <BasicDraftView draft={draft} generatedAt={enrichedDraftGeneratedAt} />
        )}

        {draft?.tier === "enriched" && (
          <EnrichedDraftView
            draft={draft}
            generatedAt={enrichedDraftGeneratedAt}
            currency={currency}
            livePricing={livePricing}
            isPioneer={isPioneer}
            placesIndex={placesIndex}
            bookings={bookings}
            tripSlug={tripSlug}
          />
        )}
      </div>

      {hasDraft && isAdmin && userId && destination && (
        <div className="mt-10 pt-6 border-t border-line grid gap-2 max-w-[440px]">
          <div className="label-sm text-fg-3">REGENERATE</div>
          <p className="text-[13px] text-fg-3 leading-[1.55]">
            Rerun the draft. Counts against your generation cap.
          </p>
          <div className="mt-1">
            <LockAndDraftCTA
              tripId={tripId}
              userId={userId}
              destination={destination}
              variant="regenerate"
            />
          </div>
        </div>
      )}
    </section>
  );
}
