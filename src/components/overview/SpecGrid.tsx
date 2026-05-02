"use client";

import { useEffect, useState } from "react";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { InlineMoneyEdit } from "@/components/ui/InlineMoneyEdit";
import { InlineTextarea } from "@/components/ui/InlineTextarea";
import { updateSpecCell } from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";
import { DEFAULT_SPEC_LABELS } from "@/lib/constants";
import type { SpecItem } from "@/lib/types";
import { PriceCellSummary } from "./PriceCellSummary";
import { FlightsSheet } from "./FlightsSheet";
import { StaySheet } from "./StaySheet";

type Props = {
  cells: SpecItem[];
  isAdmin?: boolean;
  tripId: string;
  tripSlug?: string;
  currency: string;
  // All optional so callers without live pricing data work unchanged.
  livePricing?: import("@/lib/types").LivePricing | null;
  isPioneer?: boolean;
  userId?: string;
  draftedAt?: string | null;
  lastPriceRefreshAt?: string | null;
  targetCrewSize?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  destination?: string | null;
  // Resolved from trip prefs so hasOriginIata is correct even before
  // live pricing arrives (Member sees no prices but still needs the
  // "Add origin airport" prompt when origin is unset).
  originIata?: string | null;
  destinationIata?: string | null;
};

function buildFlightFallback({
  originIata,
  destinationIata,
  departDate,
  returnDate,
  adults,
}: {
  originIata?: string;
  destinationIata?: string;
  departDate?: string | null;
  returnDate?: string | null;
  adults: number;
}): string {
  const parts: string[] = ["Flights"];
  if (originIata) parts.push(`from ${originIata}`);
  if (destinationIata) parts.push(`to ${destinationIata}`);
  if (departDate) parts.push(`on ${departDate}`);
  if (returnDate) parts.push(`returning ${returnDate}`);
  parts.push(`for ${adults} ${adults === 1 ? "adult" : "adults"}`);
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(" "))}`;
}

function buildStayFallback({
  destination,
  checkIn,
  checkOut,
}: {
  destination?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}): string {
  const params = new URLSearchParams();
  if (destination) params.set("ss", destination);
  if (checkIn) params.set("checkin", checkIn);
  if (checkOut) params.set("checkout", checkOut);
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function SpecGrid({
  cells,
  isAdmin,
  tripId,
  currency,
  livePricing,
  isPioneer,
  userId,
  draftedAt,
  lastPriceRefreshAt,
  targetCrewSize,
  startDate,
  endDate,
  destination,
  originIata,
  destinationIata,
}: Props) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<SpecItem[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [flightsSheetOpen, setFlightsSheetOpen] = useState(false);
  const [staySheetOpen, setStaySheetOpen] = useState(false);

  // Drop the optimistic overlay once the server's revalidated cells
  // land. Same reasoning as Schedule — avoids a visible flicker back
  // to the stale prop between optimistic-clear and RSC re-render.
  useEffect(() => {
    setOptimistic(null);
  }, [cells]);

  const displayed: SpecItem[] =
    optimistic ??
    (cells.length > 0
      ? cells
      : isAdmin
        ? DEFAULT_SPEC_LABELS.map((label) => ({ label, value: "", sub: "" }))
        : []);

  if (displayed.length === 0) {
    return (
      <div className="border border-line py-14 text-center mb-9">
        <div className="label-sm-wide text-fg-3">
          Spec grid · details coming soon
        </div>
      </div>
    );
  }

  const tier: "member" | "pioneer" = isPioneer ? "pioneer" : "member";
  // Derive from trip prefs (resolved at page level), not from livePricing.
  // This ensures hasOriginIata is correct for Member-tier and for trips
  // where pricing hasn't arrived yet.
  const hasOriginIata = !!originIata;
  const hasFlightOptions = (livePricing?.flights?.options?.length ?? 0) > 0;
  const hasHotelQuotes = (livePricing?.hotels?.quotes?.length ?? 0) > 0;
  const showStayCell = (targetCrewSize ?? 1) > 1 && hasHotelQuotes;
  const adults = Math.max(1, targetCrewSize ?? 1);
  const rooms = Math.max(1, Math.ceil((targetCrewSize ?? 1) / 2));

  const flightFallbackUrl = buildFlightFallback({
    originIata: originIata ?? undefined,
    destinationIata: destinationIata ?? undefined,
    departDate: startDate,
    returnDate: endDate,
    adults,
  });
  const stayFallbackUrl = buildStayFallback({
    destination,
    checkIn: startDate,
    checkOut: endDate,
  });

  const lastIndex = displayed.length - 1;

  const commit = async (
    index: number,
    patch: { value?: string; sub?: string; amount?: number | null },
  ): Promise<boolean> => {
    const prev = displayed;
    const next = prev.map((c, i): SpecItem => {
      if (i !== index) return c;
      const merged: SpecItem = { ...c, ...patch };
      if (typeof patch.amount !== "undefined" && patch.amount !== null) {
        merged.value = patch.amount.toLocaleString("en-US");
      }
      return merged;
    });
    setOptimistic(next);
    const res = await updateSpecCell({ tripId, index, patch });
    if (res?.error) {
      setOptimistic(prev);
      toast.error(res.error);
      return false;
    }
    return true;
  };

  return (
    <div className="mb-9">
      <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 border border-line">
        {displayed.map((cell, i) => {
          const isMoney = typeof cell.amount === "number";
          const dim =
            editingIndex !== null && editingIndex !== i
              ? "opacity-40 transition-opacity"
              : "transition-opacity";

          const isFlightCell = cell.label.toLowerCase().includes("flight");
          const isLastCell = i === lastIndex;
          const isStayOverride = showStayCell && isLastCell;

          return (
            <div
              key={`${cell.label}-${i}`}
              className={`py-[22px] px-6 border-r border-b border-line ${
                i % 4 === 3 ? "border-r-0" : ""
              } ${
                i >= displayed.length - (displayed.length % 4 || 4)
                  ? "last:border-b-0"
                  : ""
              } max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-last-child(-n+2)]:border-b-0 max-[520px]:border-r-0 max-[520px]:last:border-b-0 ${dim}`}
            >
              <div className="label-sm-wide text-fg-3 mb-3">
                {isStayOverride ? "STAY" : cell.label}
              </div>

              <div className="text-[22px] font-medium tracking-[-0.02em] leading-[1.2]">
                {isStayOverride ? (
                  <span>
                    {livePricing?.hotels?.quotes?.length ?? 0} picks
                  </span>
                ) : isMoney || cell.label.toLowerCase() === "per head" ? (
                  <InlineMoneyEdit
                    amount={cell.amount ?? 0}
                    currency={currency}
                    onCommit={(next) => commit(i, { amount: next })}
                    editable={!!isAdmin}
                    ariaLabel={`Edit ${cell.label} amount`}
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                  />
                ) : (
                  <InlineEdit
                    value={cell.value}
                    onCommit={(next) => commit(i, { value: next })}
                    editable={!!isAdmin}
                    as="span"
                    maxLength={80}
                    ariaLabel={`Edit ${cell.label} value`}
                    emptyLabel="Add value"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="inline"
                  />
                )}
              </div>

              <div className="label-sm text-fg-3 mt-2">
                {isStayOverride ? (
                  <button
                    type="button"
                    onClick={() => setStaySheetOpen(true)}
                    className="inline-flex items-center gap-1.5 hover:text-fg transition-colors text-left"
                  >
                    <PriceCellSummary
                      kind="stay"
                      tier={tier}
                      livePricing={livePricing}
                      draftedAtIso={draftedAt ?? null}
                    />
                  </button>
                ) : isFlightCell ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (tier === "pioneer" && hasFlightOptions) {
                        setFlightsSheetOpen(true);
                      } else {
                        window.open(flightFallbackUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 hover:text-fg transition-colors text-left"
                  >
                    <PriceCellSummary
                      kind="flight"
                      tier={tier}
                      livePricing={livePricing}
                      draftedAtIso={draftedAt ?? null}
                      hasOriginIata={hasOriginIata}
                    />
                  </button>
                ) : cell.label.toLowerCase() === "the rule" ? (
                  <InlineTextarea
                    value={cell.sub}
                    onCommit={(next) => commit(i, { sub: next })}
                    editable={!!isAdmin}
                    maxLength={60}
                    ariaLabel={`Edit ${cell.label} detail`}
                    emptyLabel="Add detail"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="label-sm"
                  />
                ) : (
                  <InlineEdit
                    value={cell.sub}
                    onCommit={(next) => commit(i, { sub: next })}
                    editable={!!isAdmin}
                    as="span"
                    maxLength={60}
                    ariaLabel={`Edit ${cell.label} detail`}
                    emptyLabel="Add detail"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="inline label-sm"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {userId && (
        <>
          <FlightsSheet
            open={flightsSheetOpen}
            onOpenChange={setFlightsSheetOpen}
            flights={livePricing?.flights}
            fallbackDeeplink={flightFallbackUrl}
            userId={userId}
            tripId={tripId}
            lastPriceRefreshAt={lastPriceRefreshAt ?? null}
            adults={adults}
          />
          <StaySheet
            open={staySheetOpen}
            onOpenChange={setStaySheetOpen}
            hotels={livePricing?.hotels}
            fallbackDeeplink={stayFallbackUrl}
            isPioneer={!!isPioneer}
            datesLabel={startDate && endDate ? `${startDate} – ${endDate}` : null}
            rooms={rooms}
            userId={userId}
            tripId={tripId}
            lastPriceRefreshAt={lastPriceRefreshAt ?? null}
            perRoomNightlyBudget={null}
          />
        </>
      )}
    </div>
  );
}
