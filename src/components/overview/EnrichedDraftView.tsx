import type { EnrichedDraft } from "@/lib/ai/schema";
import type { LivePricing } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

type Props = {
  draft: EnrichedDraft;
  generatedAt: string | null;
  currency: string;
  livePricing?: LivePricing | null;
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
}: Props) {
  const symbol = currencySymbol(currency);
  const liveFlights = livePricing?.flights ?? null;

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

      {draft.whereToStay.length > 0 && (
        <section className="grid gap-4">
          <div className="label-sm text-fg-3">WHERE TO STAY</div>
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
                {area.hotelSuggestions.length > 0 && (
                  <ul className="grid gap-1.5 mt-1">
                    {area.hotelSuggestions.map((hotel) => (
                      <li key={hotel.searchUrl} className="text-[13px]">
                        <a
                          href={hotel.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fg hover:text-accent transition-colors"
                        >
                          <span className="font-medium">{hotel.area}</span>
                          <span className="text-fg-3"> · {hotel.description}</span>
                          <span className="text-accent ml-1">↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
                              <li key={ai} className="text-[13px] text-fg-2 leading-[1.55]">
                                {act.googleMapsUrl ? (
                                  <a
                                    href={act.googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-fg hover:text-accent transition-colors"
                                  >
                                    <span className="font-medium">{act.name}</span>
                                    <span className="text-accent ml-1">↗</span>
                                  </a>
                                ) : (
                                  <span className="font-medium text-fg">{act.name}</span>
                                )}
                                {act.description && (
                                  <span className="text-fg-3"> · {act.description}</span>
                                )}
                                {act.bookAhead && (
                                  <span className="ml-2 text-[11px] uppercase tracking-wider text-accent border border-accent/40 px-1.5 py-0.5 inline-block whitespace-nowrap align-baseline">
                                    BOOK AHEAD
                                  </span>
                                )}
                              </li>
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
              <li
                key={i}
                className="px-5 py-4 grid grid-cols-[1fr_auto] gap-4 items-baseline max-[480px]:grid-cols-1"
              >
                <div>
                  <h5 className="text-[15px] font-medium text-fg">
                    {item.name}
                  </h5>
                  {item.description && item.description !== item.name && (
                    <p className="text-[13px] text-fg-2 leading-[1.55] mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.googleMapsUrl && (
                  <a
                    href={item.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label-sm-wide text-accent hover:underline shrink-0"
                  >
                    Open ↗
                  </a>
                )}
              </li>
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
            low={draft.budget.perPersonGBP.accommodationLow}
            high={draft.budget.perPersonGBP.accommodationHigh}
            symbol={symbol}
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
              {totalLow(draft.budget.perPersonGBP, liveFlights?.low)}
              <span className="text-fg-3"> – </span>
              {symbol}
              {totalHigh(draft.budget.perPersonGBP, liveFlights?.high)}
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

      {draft.flightSearchUrl && (
        <section>
          <a
            href={draft.flightSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-line bg-bg-2 hover:bg-bg-3 px-5 py-3 text-[14px] text-fg transition-colors"
          >
            <span>Search flights on Google Flights</span>
            <span className="text-accent">↗</span>
          </a>
        </section>
      )}
    </article>
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

function totalLow(
  b: EnrichedDraft["budget"]["perPersonGBP"],
  liveFlightsLow?: number,
): number {
  return Math.round(
    (liveFlightsLow ?? b.flightsLow) +
      b.accommodationLow +
      b.foodLow +
      b.activitiesLow,
  );
}

function totalHigh(
  b: EnrichedDraft["budget"]["perPersonGBP"],
  liveFlightsHigh?: number,
): number {
  return Math.round(
    (liveFlightsHigh ?? b.flightsHigh) +
      b.accommodationHigh +
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
