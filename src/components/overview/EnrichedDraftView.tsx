import type { PersistedEnrichedDraft } from "@/lib/ai/schema";
import type {
  FlightPricing,
  HotelPricing,
  HotelQuote,
  LivePricing,
  ScheduleItemPlace,
} from "@/lib/types";
import { currencySymbol } from "@/lib/currency";
import { ArrowUpRightIcon, MapPinIcon } from "@/components/ui/icons";

type Props = {
  draft: PersistedEnrichedDraft;
  generatedAt: string | null;
  currency: string;
  livePricing?: LivePricing | null;
  isPioneer?: boolean;
  placesIndex?: Map<string, ScheduleItemPlace>;
};

type LinkedActivity = {
  placeId?: string;
  name: string;
  description?: string;
  bookAhead?: boolean;
};

type ActivityPlaceLinks = {
  mapsUrl: string | null;
  websiteUrl: string | null;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PERIOD_LABEL: Record<"morning" | "afternoon" | "evening", string> = {
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
};

export function EnrichedDraftView({
  draft,
  generatedAt,
  currency,
  livePricing,
  isPioneer = false,
  placesIndex,
}: Props) {
  const symbol = currencySymbol(currency);
  const liveFlights = getLiveFlightsForTier(livePricing?.flights ?? null, isPioneer);
  const liveHotels = livePricing?.hotels ?? null;
  const liveAccom = getLiveAccommodationForTier(liveHotels, isPioneer);

  return (
    <article className="grid gap-12">
      <header className="flex items-start justify-between gap-6 flex-wrap pb-6 border-b border-line">
        <div>
          <div className="label-sm text-accent mb-2">
            ENRICHED PLAN · {draft.destination.toUpperCase()}
          </div>
          <p className="text-[18px] max-[640px]:text-[16px] text-fg leading-[1.5] max-w-[680px]">
            {draft.summary}
          </p>
        </div>
        {generatedAt && (
          <span className="label-sm text-fg-3 shrink-0">
            {formatStamp(generatedAt)}
          </span>
        )}
      </header>

      {draft.weather && (
        <section className="grid gap-3">
          <div className="label-sm text-fg-3">WEATHER</div>
          <div className="border border-line bg-bg-2 p-5 grid grid-cols-[1fr_auto] gap-6 items-center max-[480px]:grid-cols-1">
            <p className="text-[15px] text-fg leading-[1.55]">
              {draft.weather.description}
            </p>
            <div className="flex items-baseline gap-3 max-[480px]:order-first">
              <span className="text-[28px] font-medium tracking-[-0.02em] tabular-nums">
                {Math.round(draft.weather.averageHighC)}°
              </span>
              <span className="text-fg-3 text-[14px] tabular-nums">
                /{Math.round(draft.weather.averageLowC)}°
              </span>
            </div>
          </div>
        </section>
      )}

      <WhereToStaySection
        draft={draft}
        liveHotels={liveHotels}
        isPioneer={isPioneer}
      />

      {draft.itinerary.length > 0 && (
        <section className="grid gap-4">
          <div className="label-sm text-fg-3">ITINERARY</div>
          <ol className="grid gap-5">
            {draft.itinerary.map((day) => (
              <li
                key={`${day.dayNumber}-${day.date}`}
                className="border border-line bg-bg-2 p-5 grid gap-4"
              >
                <header className="flex items-baseline justify-between gap-3 flex-wrap pb-3 border-b border-line">
                  <div className="flex items-baseline gap-3">
                    <span className="label text-fg-3 tabular-nums">
                      DAY {String(day.dayNumber).padStart(2, "0")}
                    </span>
                    <h4 className="text-[20px] font-medium tracking-[-0.02em]">
                      {day.theme}
                    </h4>
                  </div>
                  <span className="label-sm text-fg-3 tabular-nums">
                    {formatDayDate(day.date)}
                  </span>
                </header>
                <div className="grid gap-4">
                  {day.blocks.map((block, i) => (
                    <div key={i} className="grid grid-cols-[88px_1fr] gap-4 max-[480px]:grid-cols-1 max-[480px]:gap-2">
                      <div className="label-sm text-fg-3 pt-0.5">
                        {PERIOD_LABEL[block.period]}
                      </div>
                      <div className="grid gap-2">
                        <h5 className="text-[15px] font-medium text-fg">
                          {block.title}
                        </h5>
                        {block.activities.length > 0 && (
                          <ul className="grid gap-1.5">
                            {block.activities.map((act, ai) => (
                              <ActivityLine
                                key={ai}
                                act={act}
                                placesIndex={placesIndex}
                              />
                            ))}
                          </ul>
                        )}
                        {block.notes && (
                          <p className="text-[13px] text-fg-3 italic leading-[1.5]">
                            {block.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {draft.bookAhead.length > 0 && (
        <section className="grid gap-4">
          <div className="label-sm text-fg-3">BOOK AHEAD</div>
          <ul className="border border-line bg-bg-2 divide-y divide-line">
            {draft.bookAhead.map((item, i) => (
              <ActivityLine
                key={i}
                act={item}
                placesIndex={placesIndex}
                className="px-5 py-4 text-[13px] text-fg-2 leading-[1.55]"
              />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4">
        <div className="label-sm text-fg-3">BUDGET · PER PERSON</div>
        <div className="border border-line bg-bg-2 p-5 grid gap-3">
          <BudgetRow
            label="Flights"
            low={liveFlights?.low ?? draft.budget.perPersonGBP.flightsLow}
            high={liveFlights?.high ?? draft.budget.perPersonGBP.flightsHigh}
            symbol={liveFlights ? currencySymbol(liveFlights.currency) : symbol}
            badge={
              liveFlights
                ? `LIVE · ${liveFlights.origin_iata} → ${liveFlights.destination_iata} · ${formatRelative(liveFlights.refreshed_at)}`
                : null
            }
          />
          <BudgetRow
            label="Accommodation"
            low={liveAccom?.low ?? draft.budget.perPersonGBP.accommodationLow}
            high={liveAccom?.high ?? draft.budget.perPersonGBP.accommodationHigh}
            symbol={liveAccom ? currencySymbol(liveAccom.currency) : symbol}
            badge={
              liveAccom
                ? `LIVE · ${liveAccom.count} picks · ${formatRelative(liveAccom.refreshedAt)}`
                : null
            }
          />
          <BudgetRow
            label="Food"
            low={draft.budget.perPersonGBP.foodLow}
            high={draft.budget.perPersonGBP.foodHigh}
            symbol={symbol}
          />
          <BudgetRow
            label="Activities"
            low={draft.budget.perPersonGBP.activitiesLow}
            high={draft.budget.perPersonGBP.activitiesHigh}
            symbol={symbol}
          />
          <div className="flex items-baseline justify-between gap-4 pt-3 border-t border-line">
            <span className="label-sm text-fg">TOTAL</span>
            <span className="text-[18px] font-medium tabular-nums">
              {symbol}
              {totalLow(draft.budget.perPersonGBP, liveFlights?.low, liveAccom?.low)}
              <span className="text-fg-3"> – </span>
              {symbol}
              {totalHigh(draft.budget.perPersonGBP, liveFlights?.high, liveAccom?.high)}
            </span>
          </div>
        </div>
        {draft.budget.caveats.length > 0 && (
          <ul className="grid gap-1 mt-1">
            {draft.budget.caveats.map((c, i) => (
              <li key={i} className="text-[12px] text-fg-3 leading-[1.55]">
                · {c}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function ActivityLine({
  act,
  placesIndex,
  className = "text-[13px] text-fg-2 leading-[1.55]",
}: {
  act: LinkedActivity;
  placesIndex?: Map<string, ScheduleItemPlace>;
  className?: string;
}) {
  const { mapsUrl, websiteUrl } = getActivityPlaceLinks({
    placeId: act.placeId,
    name: act.name,
    placesIndex,
  });

  return (
    <li className={className}>
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-fg inline-flex items-baseline gap-1 hover:text-accent transition-colors"
          title="Open in Google Maps"
        >
          <MapPinIcon className="w-3 h-3 shrink-0 self-center" />
          <span>{act.name}</span>
        </a>
      ) : (
        <span className="font-medium text-fg">{act.name}</span>
      )}
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 inline-flex items-baseline text-fg-3 hover:text-accent transition-colors align-middle"
          aria-label={`${act.name} website`}
        >
          <ArrowUpRightIcon className="w-3 h-3" />
        </a>
      )}
      {act.description && act.description !== act.name && (
        <span className="text-fg-3"> · {act.description}</span>
      )}
      {act.bookAhead && (
        <span className="ml-2 text-[11px] uppercase tracking-wider text-accent border border-accent/40 px-1.5 py-0.5 inline-block whitespace-nowrap align-baseline">
          BOOK AHEAD
        </span>
      )}
    </li>
  );
}

function normalizePlaceName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildMapsPlaceUrl(placeId: string, name: string): string {
  const params = new URLSearchParams({
    api: "1",
    query: name,
    query_place_id: placeId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function getActivityPlaceLinks({
  placeId,
  name,
  placesIndex,
}: {
  placeId?: string;
  name: string;
  placesIndex?: Map<string, ScheduleItemPlace>;
}): ActivityPlaceLinks {
  const resolvedById = placeId ? placesIndex?.get(placeId) : undefined;
  const resolvedByName = placesIndex
    ? Array.from(placesIndex.values()).find(
        (place) => normalizePlaceName(place.name) === normalizePlaceName(name),
      )
    : undefined;
  const resolved = resolvedById ?? resolvedByName;
  const mapsUrl =
    resolved?.maps_url ?? (placeId ? buildMapsPlaceUrl(placeId, name) : null);
  const websiteUrl =
    resolved?.website_url && resolved.website_url !== mapsUrl
      ? resolved.website_url
      : null;

  return { mapsUrl, websiteUrl };
}

function WhereToStaySection({
  draft,
  liveHotels,
  isPioneer,
}: {
  draft: PersistedEnrichedDraft;
  liveHotels: HotelPricing | null;
  isPioneer: boolean;
}) {
  const quotes = liveHotels?.quotes ?? [];
  const hasQuotes = quotes.length > 0 && !liveHotels?.fetch_error;
  const hasNeighbourhoods = draft.whereToStay.length > 0;
  if (!hasQuotes && !hasNeighbourhoods) return null;

  return (
    <section className="grid gap-4">
      <div className="label-sm text-fg-3">WHERE TO STAY</div>

      {hasQuotes && (
        <div className="grid gap-3">
          {renderHotelLayout(quotes.slice(0, 3), isPioneer)}
          {!isPioneer && (
            <div className="text-[13px] text-fg-2">
              Pioneer to see live prices ·{" "}
              <a href="/account" className="text-accent hover:underline">
                Upgrade →
              </a>
            </div>
          )}
        </div>
      )}

      {hasNeighbourhoods && (
        <div className="grid gap-3">
          {hasQuotes && (
            <div className="label-sm text-fg-3">NEIGHBOURHOODS</div>
          )}
          <div className="grid gap-4 grid-cols-2 max-[760px]:grid-cols-1">
            {draft.whereToStay.map((area) => (
              <div
                key={area.neighbourhood}
                className="border border-line bg-bg-2 p-5 flex flex-col gap-3"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h4 className="text-[18px] font-medium tracking-[-0.015em]">
                    {area.neighbourhood}
                  </h4>
                  <span className="label-sm text-fg-3">{area.bestFor}</span>
                </div>
                <p className="text-[14px] text-fg-2 leading-[1.55]">
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function renderHotelLayout(quotes: HotelQuote[], isPioneer: boolean) {
  if (quotes.length === 1) {
    return <FeaturedHotelCard quote={quotes[0]} isPioneer={isPioneer} />;
  }
  const gridClass =
    quotes.length === 2
      ? "grid gap-3 grid-cols-2 max-[520px]:grid-cols-1"
      : "grid gap-3 grid-cols-3 max-[520px]:grid-cols-1";
  return (
    <div className={gridClass}>
      {quotes.map((q, i) => (
        <HotelCard
          key={`${q.place_id ?? q.name}-${i}`}
          quote={q}
          isPioneer={isPioneer}
        />
      ))}
    </div>
  );
}

function FeaturedHotelCard({
  quote,
  isPioneer,
}: {
  quote: HotelQuote;
  isPioneer: boolean;
}) {
  const sym = currencySymbol(quote.price_per_night.currency);
  const target = quote.deeplink || "#";
  const Wrapper = quote.deeplink
    ? ({ children }: { children: React.ReactNode }) => (
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line bg-bg-2 hover:bg-bg-3 transition-colors grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[640px]:grid-cols-1 items-stretch"
        >
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="border border-line bg-bg-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[640px]:grid-cols-1 items-stretch">
          {children}
        </div>
      );

  return (
    <Wrapper>
      {quote.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={quote.thumbnail_url}
          alt=""
          className="w-full h-full object-cover bg-bg-3 border-r border-line min-h-[220px] max-[640px]:border-r-0 max-[640px]:border-b max-[640px]:aspect-[4/3] max-[640px]:min-h-0"
        />
      ) : (
        <div
          aria-hidden
          className="w-full h-full bg-bg-3 border-r border-line min-h-[220px] max-[640px]:border-r-0 max-[640px]:border-b max-[640px]:aspect-[4/3] max-[640px]:min-h-0"
        />
      )}
      <div className="p-6 max-[640px]:p-5 grid gap-2.5 content-center">
        <h5 className="text-[22px] max-[640px]:text-[18px] font-medium text-fg leading-[1.2] tracking-[-0.015em]">
          {quote.name}
        </h5>
        <div className="flex items-baseline gap-2.5 flex-wrap">
          {typeof quote.rating === "number" && (
            <span className="text-[13px] text-fg-2">
              <span className="text-warn">★</span> {quote.rating.toFixed(1)}
            </span>
          )}
          {isPioneer ? (
            <>
              {typeof quote.rating === "number" && (
                <span className="text-fg-3 text-[12px]">·</span>
              )}
              <span className="text-[15px] text-fg tabular">
                {sym}
                {quote.price_per_night.amount.toLocaleString()}
                <span className="text-fg-3 text-[12px]"> /nt</span>
                <span className="text-fg-3 text-[12px]"> · </span>
                {sym}
                {quote.total_price.amount.toLocaleString()}
                <span className="text-fg-3 text-[12px]"> total</span>
              </span>
            </>
          ) : (
            <span className="text-[12px] text-fg-3">
              See price on Booking.com
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

function HotelCard({ quote, isPioneer }: { quote: HotelQuote; isPioneer: boolean }) {
  const sym = currencySymbol(quote.price_per_night.currency);
  const target = quote.deeplink || "#";
  const Wrapper = quote.deeplink
    ? ({ children }: { children: React.ReactNode }) => (
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line bg-bg-2 hover:bg-bg-3 transition-colors flex flex-col"
        >
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="border border-line bg-bg-2 flex flex-col">{children}</div>
      );

  return (
    <Wrapper>
      {quote.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={quote.thumbnail_url}
          alt=""
          className="w-full aspect-[4/3] object-cover bg-bg-3 border-b border-line"
        />
      ) : (
        <div aria-hidden className="w-full aspect-[4/3] bg-bg-3 border-b border-line" />
      )}
      <div className="p-4 grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h5 className="text-[15px] font-medium text-fg leading-[1.3]">
            {quote.name}
          </h5>
          {typeof quote.rating === "number" && (
            <span className="text-[12px] text-fg-2 shrink-0">
              <span className="text-warn">★</span> {quote.rating.toFixed(1)}
            </span>
          )}
        </div>
        {isPioneer ? (
          <div className="text-[13px] text-fg-2 tabular">
            {sym}
            {quote.price_per_night.amount.toLocaleString()}
            <span className="text-fg-3"> /nt · </span>
            {sym}
            {quote.total_price.amount.toLocaleString()}
            <span className="text-fg-3"> total</span>
          </div>
        ) : (
          <div className="text-[12px] text-fg-3">See price on Booking.com</div>
        )}
      </div>
    </Wrapper>
  );
}

function BudgetRow({
  label,
  low,
  high,
  symbol,
  badge,
}: {
  label: string;
  low: number;
  high: number;
  symbol: string;
  badge?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap">
      <span className="text-[14px] text-fg-2 flex items-baseline gap-2 flex-wrap">
        {label}
        {badge && (
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent border border-accent/30 px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[14px] tabular-nums">
        {symbol}
        {Math.round(low)}
        <span className="text-fg-3"> – </span>
        {symbol}
        {Math.round(high)}
      </span>
    </div>
  );
}

function computeLiveAccommodation(
  liveHotels: HotelPricing | null,
): { low: number; high: number; currency: string; count: number; refreshedAt: string } | null {
  if (!liveHotels || liveHotels.fetch_error) return null;
  const quotes = liveHotels.quotes ?? [];
  if (quotes.length === 0) return null;
  // Per-person estimate: each room sleeps 2, so total_price / 2 = per-person
  // for the entire stay. Coarse but matches how we sized rooms in the
  // SerpApi query (2 adults per room).
  const totals = quotes.map((q) => q.total_price.amount).filter((n) => n > 0);
  if (totals.length === 0) return null;
  const low = Math.min(...totals) / 2;
  const high = Math.max(...totals) / 2;
  return {
    low,
    high,
    currency: quotes[0].total_price.currency,
    count: quotes.length,
    refreshedAt: liveHotels.refreshed_at,
  };
}

export function getLiveAccommodationForTier(
  liveHotels: HotelPricing | null,
  isPioneer: boolean,
): { low: number; high: number; currency: string; count: number; refreshedAt: string } | null {
  if (!isPioneer) return null;
  return computeLiveAccommodation(liveHotels);
}

// Member must never see live flight pricing in the budget rows. Defense
// in depth: lockAndDraft only fetches flights for Pioneer trips, but
// stale data from a prior Pioneer state or a race during a tier change
// could leak through. This helper makes the gate explicit at render
// time so the BudgetRow renderer cannot accidentally show live numbers
// to a Member.
export function getLiveFlightsForTier(
  liveFlights: FlightPricing | null,
  isPioneer: boolean,
): FlightPricing | null {
  if (!isPioneer) return null;
  if (!liveFlights || liveFlights.fetch_error) return null;
  return liveFlights;
}

function totalLow(
  b: PersistedEnrichedDraft["budget"]["perPersonGBP"],
  liveFlightsLow?: number,
  liveAccomLow?: number,
): number {
  return Math.round(
    (liveFlightsLow ?? b.flightsLow) +
      (liveAccomLow ?? b.accommodationLow) +
      b.foodLow +
      b.activitiesLow,
  );
}

function totalHigh(
  b: PersistedEnrichedDraft["budget"]["perPersonGBP"],
  liveFlightsHigh?: number,
  liveAccomHigh?: number,
): number {
  return Math.round(
    (liveFlightsHigh ?? b.flightsHigh) +
      (liveAccomHigh ?? b.accommodationHigh) +
      b.foodHigh +
      b.activitiesHigh,
  );
}

function formatDayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}
