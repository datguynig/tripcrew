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

import type { FareOption, HotelQuote } from "@/lib/types";

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
  // low/high preserved for backward compat with priceRefresh consumers;
  // options/best_price are the structured form.
  options: FareOption[];
  best_price: { amount: number; currency: string };
};

type SerpApiFlightOption = {
  price?: number;
};

type SerpApiResponse = {
  best_flights?: SerpApiFlightOption[];
  other_flights?: SerpApiFlightOption[];
  error?: string;
};

type SerpFlight = {
  airline?: string;
  airline_logo?: string;
  duration?: number;
  departure_airport?: { time?: string };
  arrival_airport?: { time?: string };
};

type SerpFlightOption = {
  price?: number;
  flights?: SerpFlight[];
  layovers?: unknown[];
  booking_token?: string;
};

const SERPAPI_FLIGHT_DEEPLINK_BASE = "https://www.google.com/travel/flights/booking";

export function parseFlightOptions(raw: unknown, currency: string): FareOption[] {
  if (!raw || typeof raw !== "object") return [];
  const j = raw as { best_flights?: SerpFlightOption[]; other_flights?: SerpFlightOption[] };
  const all = [...(j.best_flights ?? []), ...(j.other_flights ?? [])];
  const options: FareOption[] = [];
  for (const opt of all) {
    if (typeof opt.price !== "number" || opt.price <= 0) continue;
    const first = opt.flights?.[0];
    if (!first) continue;
    options.push({
      airline: first.airline ?? "Unknown",
      airline_logo_url: first.airline_logo ?? null,
      price: { amount: Math.round(opt.price), currency },
      duration_minutes: typeof first.duration === "number" ? first.duration : 0,
      stops: Array.isArray(opt.layovers) ? opt.layovers.length : 0,
      depart_iso: first.departure_airport?.time ?? "",
      arrive_iso: first.arrival_airport?.time ?? "",
      deeplink: opt.booking_token
        ? `${SERPAPI_FLIGHT_DEEPLINK_BASE}?token=${encodeURIComponent(opt.booking_token)}`
        : "",
    });
  }
  options.sort((a, b) => a.price.amount - b.price.amount);
  return options.slice(0, 3);
}

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

  const options = parseFlightOptions(json, search.currency);
  const cheapestFromOptions = options[0]?.price;
  const best_price = cheapestFromOptions ?? {
    amount: Math.round(Math.min(...prices)),
    currency: search.currency,
  };
  return {
    low,
    high: median,
    currency: search.currency,
    sampleCount: prices.length,
    options,
    best_price,
  };
}

export type HotelSearch = {
  destination: string;
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  rooms: number;
  perRoomBudget?: number; // GBP nightly upper bound
  currency: string;       // e.g. "GBP"
};

type SerpHotelProperty = {
  name?: string;
  place_id?: string;
  total_rate?: { extracted_lowest?: number; extracted_currency?: string };
  rate_per_night?: { extracted_lowest?: number; extracted_currency?: string };
  overall_rating?: number;
  images?: Array<{ original_image?: string; thumbnail?: string }>;
  link?: string;
};

type SerpHotelResponse = {
  properties?: SerpHotelProperty[];
  error?: string;
};

export function parseHotelResponse(
  raw: unknown,
  currency: string,
): HotelQuote[] {
  if (!raw || typeof raw !== "object") return [];
  const json = raw as SerpHotelResponse;
  const properties = Array.isArray(json.properties) ? json.properties : [];
  const quotes: HotelQuote[] = [];

  for (const p of properties) {
    const ppNight = p.rate_per_night?.extracted_lowest;
    const ppTotal = p.total_rate?.extracted_lowest;
    if (typeof ppNight !== "number" || typeof ppTotal !== "number") continue;
    if (ppNight <= 0 || ppTotal <= 0) continue;
    const name = (p.name ?? "").trim();
    if (!name) continue;
    quotes.push({
      name,
      place_id: p.place_id ?? null,
      rating: typeof p.overall_rating === "number" ? p.overall_rating : null,
      price_per_night: { amount: Math.round(ppNight), currency },
      total_price: { amount: Math.round(ppTotal), currency },
      thumbnail_url: p.images?.[0]?.thumbnail ?? p.images?.[0]?.original_image ?? null,
      deeplink: p.link ?? "",
    });
  }

  // Sort by rating desc, then price ascending. Ties resolve to the
  // cheaper option so the user's first pick is never the priciest.
  quotes.sort((a, b) => {
    const ra = a.rating ?? 0;
    const rb = b.rating ?? 0;
    if (rb !== ra) return rb - ra;
    return a.price_per_night.amount - b.price_per_night.amount;
  });

  return quotes.slice(0, 3);
}

export async function fetchHotelQuotes(
  search: HotelSearch,
): Promise<HotelQuote[] | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: search.destination,
    check_in_date: search.checkIn,
    check_out_date: search.checkOut,
    // SerpApi Google Hotels caps at 6 travellers per query. For larger
    // crews we still surface the top-3 hotels (filtered for what fits
    // within 6 adults across the requested rooms); admins can complete
    // the actual booking off-platform when the real party size exceeds 6.
    adults: String(Math.min(6, Math.max(1, search.rooms * 2))),
    currency: search.currency,
    hl: "en",
    api_key: apiKey,
  });
  if (search.perRoomBudget && search.perRoomBudget > 0) {
    params.set("max_price", String(Math.round(search.perRoomBudget)));
  }

  const url = `${SERPAPI_BASE}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[serpapi.hotels] network error", err);
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[serpapi.hotels] HTTP ${res.status}: ${body.slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as SerpHotelResponse;
  if (json.error) {
    console.error("[serpapi.hotels] api error:", json.error);
    return null;
  }
  return parseHotelResponse(json, search.currency);
}
