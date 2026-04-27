/**
 * SerpApi Google Flights wrapper.
 *
 * Endpoint: https://serpapi.com/search.json?engine=google_flights
 *
 * Uses the user's currency so prices come back in GBP (or whatever the
 * trip is set to). Returns the cheapest + median price across all
 * "best" + "other" flight options. Median is more representative than
 * cheapest alone (cheapest is often overnight + 2-stop), and gives the
 * crew a useful range alongside it.
 *
 * Never imported from a "use client" file — needs SERPAPI_KEY.
 */

const SERPAPI_BASE = "https://serpapi.com/search.json";

export type FlightSearch = {
  originIata: string;
  destinationIata: string;
  outboundDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  adults: number;
  currency: string; // e.g. "GBP"
};

export type FlightPrices = {
  low: number;
  high: number;
  currency: string;
  sampleCount: number;
};

type SerpApiFlightOption = {
  price?: number;
};

type SerpApiResponse = {
  best_flights?: SerpApiFlightOption[];
  other_flights?: SerpApiFlightOption[];
  error?: string;
};

export function serpApiEnabled(): boolean {
  return (process.env.SERPAPI_KEY ?? "").length > 0;
}

export async function fetchFlightPrices(
  search: FlightSearch,
): Promise<FlightPrices | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: search.originIata,
    arrival_id: search.destinationIata,
    outbound_date: search.outboundDate,
    return_date: search.returnDate,
    adults: String(search.adults),
    currency: search.currency,
    hl: "en",
    api_key: apiKey,
  });

  const url = `${SERPAPI_BASE}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      // SerpApi can take a few seconds; trust the platform default
      // function timeout (300s on Fluid Compute) rather than aborting.
      cache: "no-store",
    });
  } catch (err) {
    console.error("[serpapi] network error", err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[serpapi] HTTP ${res.status} for ${search.originIata}→${search.destinationIata}: ${body.slice(0, 200)}`,
    );
    return null;
  }

  const json = (await res.json()) as SerpApiResponse;
  if (json.error) {
    console.error("[serpapi] api error:", json.error);
    return null;
  }

  const prices: number[] = [];
  for (const opt of json.best_flights ?? []) {
    if (typeof opt.price === "number" && opt.price > 0) prices.push(opt.price);
  }
  for (const opt of json.other_flights ?? []) {
    if (typeof opt.price === "number" && opt.price > 0) prices.push(opt.price);
  }

  if (prices.length === 0) return null;

  prices.sort((a, b) => a - b);
  const low = prices[0];
  const median = prices[Math.floor(prices.length / 2)];

  return {
    low,
    high: median,
    currency: search.currency,
    sampleCount: prices.length,
  };
}
