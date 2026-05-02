"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import type { FlightPricing, FareOption } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";
import { RefreshPricesButton } from "./RefreshPricesButton";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flights: FlightPricing | null | undefined;
  fallbackDeeplink: string;
  // Identity for refresh button + crew context for header.
  userId: string;
  tripId: string;
  lastPriceRefreshAt: string | null;
  adults: number;
};

export function FlightsSheet({
  open,
  onOpenChange,
  flights,
  fallbackDeeplink,
  userId,
  tripId,
  lastPriceRefreshAt,
  adults,
}: Props) {
  const sym = flights ? currencySymbol(flights.currency) : "£";
  const headerSub = useMemo(
    () => buildHeaderSub(flights, adults),
    [flights, adults],
  );

  const options = flights?.options ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(540px,calc(100vw-32px))] p-6">
        <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <DialogTitle className="mb-1.5 text-[20px] font-medium tracking-[-0.02em]">
              Flights
            </DialogTitle>
            {headerSub && (
              <div className="label-sm-wide text-fg-3">{headerSub}</div>
            )}
          </div>
          <RefreshPricesButton
            userId={userId}
            tripId={tripId}
            lastPriceRefreshAt={lastPriceRefreshAt}
          />
        </div>

        {options.length > 0 ? (
          <div className="grid gap-2">
            {options.slice(0, 3).map((opt, i) => (
              <FareRow
                key={`${opt.airline}-${opt.depart_iso}-${i}`}
                option={opt}
                fallbackDeeplink={fallbackDeeplink}
                currencySym={sym}
              />
            ))}
          </div>
        ) : (
          <div className="border border-line bg-bg p-5 text-center text-fg-3 text-sm">
            No live fares available. Try the search below.
          </div>
        )}

        <a
          href={fallbackDeeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-[13px] text-fg-3 hover:text-fg transition-colors"
        >
          + See more on Google Flights →
        </a>

        {flights?.refreshed_at && (
          <div className="mt-4 pt-4 border-t border-line text-center label-sm tabular text-fg-3">
            UPDATED {formatRelative(flights.refreshed_at)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FareRow({
  option,
  fallbackDeeplink,
  currencySym,
}: {
  option: FareOption;
  fallbackDeeplink: string;
  currencySym: string;
}) {
  const stops = option.stops;
  const stopsLabel =
    stops === 0 ? "DIRECT" : stops === 1 ? "1 STOP" : `${stops} STOPS`;
  const stopsClass = stops === 0 ? "text-ok" : "text-fg-2";
  return (
    <a
      href={option.deeplink || fallbackDeeplink}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[24px_1fr_auto] gap-3 items-center px-3.5 py-3
        border border-line bg-bg
        hover:border-line-2 hover:bg-bg-3 transition-colors"
    >
      <AirlineLogo logoUrl={option.airline_logo_url} airline={option.airline} />
      <div className="min-w-0">
        <div className="text-[14px] font-medium tracking-[-0.01em] truncate">
          {option.airline}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[12px] text-fg-2">
          <span className="font-mono text-[11px] tracking-[0.05em] text-fg-3">
            {formatTime(option.depart_iso)} → {formatTime(option.arrive_iso)}
          </span>
          <span className={`label-xs ${stopsClass}`}>{stopsLabel}</span>
          <span className="text-fg-3">·</span>
          <span className="tabular text-[12px]">
            {formatDuration(option.duration_minutes)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[18px] font-medium tracking-[-0.015em] tabular">
          {currencySym}
          {option.price.amount.toLocaleString()}
        </div>
        <div className="label-sm text-fg-3 mt-0.5">BOOK →</div>
      </div>
    </a>
  );
}

function AirlineLogo({
  logoUrl,
  airline,
}: {
  logoUrl: string | null;
  airline: string;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        className="w-6 h-6 object-contain bg-bg-3 border border-line"
      />
    );
  }
  return (
    <div className="w-6 h-6 bg-bg-3 border border-line flex items-center justify-center label-xs text-fg-2">
      {airline.slice(0, 2).toUpperCase()}
    </div>
  );
}

function buildHeaderSub(
  flights: FlightPricing | null | undefined,
  adults: number,
): string | null {
  if (!flights) return null;
  const parts: string[] = [];
  parts.push(flights.origin_iata);
  parts.push(flights.destination_iata);
  parts.push(`${adults} ${adults === 1 ? "ADULT" : "ADULTS"}`);
  return parts.join(" · ");
}

function formatTime(iso: string): string {
  if (!iso) return "";
  // SerpApi returns "YYYY-MM-DD HH:mm" — extract HH:mm.
  const match = /\b(\d{2}:\d{2})\b/.exec(iso);
  return match?.[1] ?? "";
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "JUST NOW";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "JUST NOW";
  if (min < 60) return `${min} MIN AGO`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  return `${d}D AGO`;
}
