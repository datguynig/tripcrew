"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import type { HotelPricing, HotelQuote } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";
import { RefreshPricesButton } from "./RefreshPricesButton";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotels: HotelPricing | null | undefined;
  fallbackDeeplink: string;
  // Tier flag drives whether prices + refresh render.
  isPioneer: boolean;
  // For the header sub-line.
  datesLabel: string | null;
  rooms: number;
  // For RefreshPricesButton (Pioneer only).
  userId: string;
  tripId: string;
  lastPriceRefreshAt: string | null;
  // Per-room nightly cap derived from trip target_budget_pp / days * 0.4 * 2.
  // Drives the "Above budget" pill. Optional.
  perRoomNightlyBudget?: number | null;
};

export function StaySheet({
  open,
  onOpenChange,
  hotels,
  fallbackDeeplink,
  isPioneer,
  datesLabel,
  rooms,
  userId,
  tripId,
  lastPriceRefreshAt,
  perRoomNightlyBudget,
}: Props) {
  const quotes = hotels?.quotes ?? [];
  const headerSub = buildHeaderSub(datesLabel, rooms);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(540px,calc(100vw-32px))] p-6">
        <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <DialogTitle className="mb-1.5 text-[20px] font-medium tracking-[-0.02em]">
              {quotes.length > 0
                ? `${quotes.length} ${quotes.length === 1 ? "stay" : "stays"}`
                : "Stays"}
            </DialogTitle>
            {headerSub && (
              <div className="label-sm-wide text-fg-3">{headerSub}</div>
            )}
          </div>
          {isPioneer && (
            <RefreshPricesButton
              userId={userId}
              tripId={tripId}
              lastPriceRefreshAt={lastPriceRefreshAt}
            />
          )}
        </div>

        {quotes.length > 0 ? (
          <div className="grid gap-2">
            {quotes.map((q, i) => (
              <HotelRow
                key={`${q.place_id ?? q.name}-${i}`}
                quote={q}
                fallbackDeeplink={fallbackDeeplink}
                isPioneer={isPioneer}
                perRoomNightlyBudget={perRoomNightlyBudget ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="border border-line bg-bg p-5 text-center text-fg-3 text-sm">
            No hotel picks available right now.
          </div>
        )}

        <a
          href={fallbackDeeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-[13px] text-fg-3 hover:text-fg transition-colors"
        >
          + See more on Booking.com →
        </a>

        {!isPioneer && (
          <div className="mt-4 pt-4 border-t border-line text-center text-[13px] text-fg-2">
            Pioneer to see live prices ·{" "}
            <a href="/account" className="text-accent hover:underline">
              Upgrade →
            </a>
          </div>
        )}

        {isPioneer && hotels?.refreshed_at && (
          <div className="mt-4 pt-4 border-t border-line text-center label-sm tabular text-fg-3">
            UPDATED {formatRelative(hotels.refreshed_at)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HotelRow({
  quote,
  fallbackDeeplink,
  isPioneer,
  perRoomNightlyBudget,
}: {
  quote: HotelQuote;
  fallbackDeeplink: string;
  isPioneer: boolean;
  perRoomNightlyBudget: number | null;
}) {
  const sym = currencySymbol(quote.price_per_night.currency);
  const aboveBudget =
    perRoomNightlyBudget !== null &&
    perRoomNightlyBudget > 0 &&
    quote.price_per_night.amount > perRoomNightlyBudget;

  return (
    <a
      href={quote.deeplink || fallbackDeeplink}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[80px_1fr_auto] gap-3.5 items-stretch p-3.5
        border border-line bg-bg
        hover:border-line-2 hover:bg-bg-3 transition-colors group"
    >
      <Thumb url={quote.thumbnail_url} />
      <div className="min-w-0 pt-0.5">
        <div className="text-[15px] font-medium tracking-[-0.01em] flex items-center gap-2.5 flex-wrap">
          <span className="truncate">{quote.name}</span>
          {typeof quote.rating === "number" && (
            <span className="text-[12px] text-fg-2 shrink-0">
              <span className="text-warn">★</span> {quote.rating.toFixed(1)}
            </span>
          )}
          {aboveBudget && (
            <span className="label-xs text-warn border border-warn/30 px-1.5 py-0.5">
              ABOVE BUDGET
            </span>
          )}
        </div>
        {isPioneer && (
          <div className="text-[13px] text-fg-2 tabular mt-1.5">
            {sym}
            {quote.price_per_night.amount.toLocaleString()}
            <span className="text-fg-3 text-[12px]">/nt</span>
            <span className="text-fg-3 text-[12px] ml-1.5">
              · {sym}
              {quote.total_price.amount.toLocaleString()} / room
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between">
        {isPioneer && (
          <div className="text-right">
            <div className="text-[18px] font-medium tracking-[-0.015em] tabular">
              {sym}
              {quote.price_per_night.amount.toLocaleString()}
            </div>
          </div>
        )}
        <span className="text-[12px] text-fg-3 group-hover:text-accent transition-colors">
          See →
        </span>
      </div>
    </a>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        className="w-20 h-20 object-cover bg-bg-3 border border-line"
      />
    );
  }
  // Plain bg-3 fallback per design feedback (gradient was rejected as gimmicky).
  return (
    <div
      aria-hidden="true"
      className="w-20 h-20 bg-bg-3 border border-line"
    />
  );
}

function buildHeaderSub(datesLabel: string | null, rooms: number): string | null {
  const parts: string[] = [];
  if (datesLabel) parts.push(datesLabel.toUpperCase());
  parts.push(`${rooms} ${rooms === 1 ? "ROOM" : "ROOMS"}`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
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
