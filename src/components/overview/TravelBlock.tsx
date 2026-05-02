"use client";

import { useState } from "react";
import type { LivePricing } from "@/lib/types";
import { PriceCellSummary } from "./PriceCellSummary";
import { FlightsSheet } from "./FlightsSheet";
import { StaySheet } from "./StaySheet";
import { RefreshPricesButton } from "./RefreshPricesButton";

type Props = {
  livePricing: LivePricing | null | undefined;
  isPioneer: boolean;
  userId: string | null;
  tripId: string;
  draftedAt: string | null;
  lastPriceRefreshAt: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  targetCrewSize: number | null;
  originIata: string | null;
  originLabel: string | null;
  destinationIata: string | null;
};

function buildFlightFallback({
  originIata,
  originLabel,
  destinationIata,
  destinationLabel,
  departDate,
  returnDate,
  adults,
}: {
  originIata?: string;
  originLabel?: string;
  destinationIata?: string;
  destinationLabel?: string;
  departDate?: string | null;
  returnDate?: string | null;
  adults: number;
}): string {
  const parts: string[] = ["Flights"];
  const fromText = originIata ?? originLabel;
  if (fromText) parts.push(`from ${fromText}`);
  const toText = destinationIata ?? destinationLabel;
  if (toText) parts.push(`to ${toText}`);
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

export function TravelBlock({
  livePricing,
  isPioneer,
  userId,
  tripId,
  draftedAt,
  lastPriceRefreshAt,
  destination,
  startDate,
  endDate,
  targetCrewSize,
  originIata,
  originLabel,
  destinationIata,
}: Props) {
  const [flightsSheetOpen, setFlightsSheetOpen] = useState(false);
  const [staySheetOpen, setStaySheetOpen] = useState(false);

  const tier: "member" | "pioneer" = isPioneer ? "pioneer" : "member";
  const hasOriginConfigured = !!originIata || !!originLabel;
  const hasFlightOptions = (livePricing?.flights?.options?.length ?? 0) > 0;
  const adults = Math.max(1, targetCrewSize ?? 1);
  const rooms = Math.max(1, Math.ceil((targetCrewSize ?? 1) / 2));

  const flightFallbackUrl = buildFlightFallback({
    originIata: originIata ?? undefined,
    originLabel: originLabel ?? undefined,
    destinationIata: destinationIata ?? undefined,
    destinationLabel: destination ?? undefined,
    departDate: startDate,
    returnDate: endDate,
    adults,
  });
  const stayFallbackUrl = buildStayFallback({
    destination,
    checkIn: startDate,
    checkOut: endDate,
  });

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label-sm text-fg-3">TRAVEL</div>
        {isPioneer && userId && (
          <RefreshPricesButton
            userId={userId}
            tripId={tripId}
            lastPriceRefreshAt={lastPriceRefreshAt}
          />
        )}
      </div>
      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 border border-line">
        <button
          type="button"
          onClick={() => {
            if (tier === "pioneer" && hasFlightOptions) {
              setFlightsSheetOpen(true);
            } else {
              window.open(flightFallbackUrl, "_blank", "noopener,noreferrer");
            }
          }}
          className="text-left py-[22px] px-6 border-r border-line max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-line bg-bg-2 hover:bg-bg-3 transition-colors"
        >
          <div className="label-sm-wide text-fg-3 mb-3">FLIGHTS</div>
          <div className="text-[18px] font-medium tracking-[-0.02em] leading-[1.2]">
            <PriceCellSummary
              kind="flight"
              tier={tier}
              livePricing={livePricing}
              draftedAtIso={draftedAt}
              hasOriginIata={hasOriginConfigured}
            />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setStaySheetOpen(true)}
          className="text-left py-[22px] px-6 bg-bg-2 hover:bg-bg-3 transition-colors"
        >
          <div className="label-sm-wide text-fg-3 mb-3">STAY</div>
          <div className="text-[18px] font-medium tracking-[-0.02em] leading-[1.2]">
            <PriceCellSummary
              kind="stay"
              tier={tier}
              livePricing={livePricing}
              draftedAtIso={draftedAt}
            />
          </div>
        </button>
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
            lastPriceRefreshAt={lastPriceRefreshAt}
            adults={adults}
          />
          <StaySheet
            open={staySheetOpen}
            onOpenChange={setStaySheetOpen}
            hotels={livePricing?.hotels}
            fallbackDeeplink={stayFallbackUrl}
            isPioneer={isPioneer}
            datesLabel={startDate && endDate ? `${startDate} – ${endDate}` : null}
            rooms={rooms}
            userId={userId}
            tripId={tripId}
            lastPriceRefreshAt={lastPriceRefreshAt}
            perRoomNightlyBudget={null}
          />
        </>
      )}
    </section>
  );
}
