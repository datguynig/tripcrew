export interface FlightSearchParams {
  origin?: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
}

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}

/**
 * Build a Google Flights search URL. Accepts free-text origin/destination
 * — Google Flights resolves them via its own search, no IATA mapping
 * needed. Reliable fallback when we don't have airport codes.
 *
 * Supersedes the older `buildSkyscannerUrl` which produced dead links
 * because its destination → city-code mapping was wrong (e.g. "Barcelona"
 * became `barc`; the real Skyscanner code is `bcna`). Skyscanner-with-IATA
 * + affiliate revenue is a deferred v2 follow-up.
 */
export function buildGoogleFlightsUrl(params: FlightSearchParams): string {
  const parts: string[] = ["Flights"];
  if (params.origin) parts.push(`from ${params.origin}`);
  parts.push(`to ${params.destination}`);
  parts.push(`on ${params.departDate}`);
  if (params.returnDate) parts.push(`returning ${params.returnDate}`);
  parts.push(
    `for ${params.adults} ${params.adults === 1 ? "adult" : "adults"}`,
  );
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(" "))}`;
}

export function buildBookingUrl(params: HotelSearchParams): string {
  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", params.destination);
  url.searchParams.set("checkin", params.checkIn);
  url.searchParams.set("checkout", params.checkOut);
  url.searchParams.set("group_adults", String(params.adults));
  url.searchParams.set("no_rooms", String(Math.max(1, Math.ceil(params.adults / 2))));
  return url.toString();
}

export function buildViatorUrl(destination: string): string {
  const slug = destination
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.viator.com/${slug}/d-things-to-do?searchTerm=${encodeURIComponent(destination)}`;
}
