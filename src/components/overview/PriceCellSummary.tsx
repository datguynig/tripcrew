import type { LivePricing } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

const STALE_AFTER_MS = 60_000;

type Kind = "flight" | "stay";
type Tier = "member" | "pioneer";

type Props = {
  kind: Kind;
  tier: Tier;
  livePricing: LivePricing | null | undefined;
  draftedAtIso: string | null;
  hasOriginIata?: boolean;
};

export function PriceCellSummary({
  kind,
  tier,
  livePricing,
  draftedAtIso,
  hasOriginIata = true,
}: Props) {
  if (kind === "flight" && !hasOriginIata) {
    return (
      <span className="inline-flex items-center gap-1.5">
        Add origin airport <Arrow />
      </span>
    );
  }

  const draftedMs = draftedAtIso ? Date.parse(draftedAtIso) : null;
  const isStale =
    draftedMs !== null && Number.isFinite(draftedMs) && Date.now() - draftedMs > STALE_AFTER_MS;
  const flights = livePricing?.flights;
  const hotels = livePricing?.hotels;

  if (kind === "flight") {
    if (tier === "member") {
      return (
        <span className="inline-flex items-center gap-1.5">
          Search flights <Arrow />
        </span>
      );
    }
    if (flights?.options?.length && !flights.fetch_error) {
      const sym = currencySymbol(flights.currency);
      const cheapest = flights.best_price?.amount ?? flights.options[0].price.amount;
      return (
        <span className="inline-flex items-center gap-1.5 tabular text-fg font-medium">
          from {sym}
          {cheapest.toLocaleString()} return <Arrow accent />
        </span>
      );
    }
    if (flights?.fetch_error || isStale) {
      return (
        <span className="inline-flex items-center gap-1.5 text-fg-2">
          <ErrorDot />
          Search flights <Arrow />
        </span>
      );
    }
    return <Loading />;
  }

  // kind === "stay"
  if (hotels?.quotes && hotels.quotes.length > 0 && !hotels.fetch_error) {
    const count = hotels.quotes.length;
    const cheapest = hotels.quotes[0].price_per_night;
    const sym = currencySymbol(cheapest.currency);
    if (tier === "member") {
      return (
        <span className="inline-flex items-center gap-1.5">
          {count} picks · See on Booking.com <Arrow />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 tabular text-fg font-medium">
        {count} picks · {sym}
        {cheapest.amount.toLocaleString()}/nt <Arrow accent />
      </span>
    );
  }

  if (tier === "member") {
    return (
      <span className="inline-flex items-center gap-1.5">
        Search hotels <Arrow />
      </span>
    );
  }
  if (hotels?.fetch_error || isStale) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-2">
        <ErrorDot />
        Search hotels <Arrow />
      </span>
    );
  }
  return <Loading />;
}

function Arrow({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={accent ? "text-accent" : "text-fg-3"}
    >
      →
    </span>
  );
}

function ErrorDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-[6px] h-[6px] rounded-full bg-err shrink-0"
    />
  );
}

function Loading() {
  return (
    <span className="inline-flex items-center gap-2 text-fg-3">
      Pricing
      <span
        aria-hidden="true"
        className="inline-block w-8 h-2 bg-bg-3 animate-skeleton"
      />
    </span>
  );
}
