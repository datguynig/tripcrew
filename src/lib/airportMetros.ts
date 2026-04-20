/**
 * IATA metropolitan area codes — a separate airline-industry standard
 * that clusters a city's airports under a single code. Google Places
 * doesn't expose these, so we curate the 20 or so that cover most
 * group trips. The typeahead surfaces a synthetic "[City] — all
 * airports" row at the top of the dropdown when the query matches a
 * metro name or IATA code.
 *
 * Purpose: for the AI draft's "Flights" spec cell, "LON → ARN" reads
 * more honestly than committing to "LHR → ARN" when the crew might
 * fly from any London airport.
 *
 * City centre coordinates are used as a location bias for Places when
 * needed; they're not the metro's "real" position (metros are logical
 * aggregates, not points).
 */

export type AirportMetro = {
  iata: string;
  name: string;
  country: string;
  airports: Array<{ iata: string; name: string }>;
  latitude: number;
  longitude: number;
};

export const AIRPORT_METROS: AirportMetro[] = [
  {
    iata: "LON",
    name: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    airports: [
      { iata: "LHR", name: "Heathrow" },
      { iata: "LGW", name: "Gatwick" },
      { iata: "LTN", name: "Luton" },
      { iata: "STN", name: "Stansted" },
      { iata: "LCY", name: "City" },
      { iata: "SEN", name: "Southend" },
    ],
  },
  {
    iata: "NYC",
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    airports: [
      { iata: "JFK", name: "John F. Kennedy" },
      { iata: "LGA", name: "LaGuardia" },
      { iata: "EWR", name: "Newark" },
    ],
  },
  {
    iata: "PAR",
    name: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    airports: [
      { iata: "CDG", name: "Charles de Gaulle" },
      { iata: "ORY", name: "Orly" },
      { iata: "BVA", name: "Beauvais" },
    ],
  },
  {
    iata: "TYO",
    name: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
    airports: [
      { iata: "NRT", name: "Narita" },
      { iata: "HND", name: "Haneda" },
    ],
  },
  {
    iata: "MIL",
    name: "Milan",
    country: "Italy",
    latitude: 45.4642,
    longitude: 9.19,
    airports: [
      { iata: "MXP", name: "Malpensa" },
      { iata: "LIN", name: "Linate" },
      { iata: "BGY", name: "Bergamo Orio al Serio" },
    ],
  },
  {
    iata: "ROM",
    name: "Rome",
    country: "Italy",
    latitude: 41.9028,
    longitude: 12.4964,
    airports: [
      { iata: "FCO", name: "Fiumicino" },
      { iata: "CIA", name: "Ciampino" },
    ],
  },
  {
    iata: "YTO",
    name: "Toronto",
    country: "Canada",
    latitude: 43.6532,
    longitude: -79.3832,
    airports: [
      { iata: "YYZ", name: "Pearson" },
      { iata: "YTZ", name: "Billy Bishop City" },
    ],
  },
  {
    iata: "WAS",
    name: "Washington",
    country: "United States",
    latitude: 38.9072,
    longitude: -77.0369,
    airports: [
      { iata: "IAD", name: "Dulles" },
      { iata: "DCA", name: "Reagan National" },
      { iata: "BWI", name: "Baltimore/Washington" },
    ],
  },
  {
    iata: "CHI",
    name: "Chicago",
    country: "United States",
    latitude: 41.8781,
    longitude: -87.6298,
    airports: [
      { iata: "ORD", name: "O'Hare" },
      { iata: "MDW", name: "Midway" },
    ],
  },
  {
    iata: "BJS",
    name: "Beijing",
    country: "China",
    latitude: 39.9042,
    longitude: 116.4074,
    airports: [
      { iata: "PEK", name: "Capital" },
      { iata: "PKX", name: "Daxing" },
    ],
  },
  {
    iata: "SHA",
    name: "Shanghai",
    country: "China",
    latitude: 31.2304,
    longitude: 121.4737,
    airports: [
      { iata: "PVG", name: "Pudong" },
      { iata: "SHA", name: "Hongqiao" },
    ],
  },
  {
    iata: "SEL",
    name: "Seoul",
    country: "South Korea",
    latitude: 37.5665,
    longitude: 126.978,
    airports: [
      { iata: "ICN", name: "Incheon" },
      { iata: "GMP", name: "Gimpo" },
    ],
  },
  {
    iata: "SAO",
    name: "São Paulo",
    country: "Brazil",
    latitude: -23.5505,
    longitude: -46.6333,
    airports: [
      { iata: "GRU", name: "Guarulhos" },
      { iata: "CGH", name: "Congonhas" },
      { iata: "VCP", name: "Viracopos" },
    ],
  },
  {
    iata: "RIO",
    name: "Rio de Janeiro",
    country: "Brazil",
    latitude: -22.9068,
    longitude: -43.1729,
    airports: [
      { iata: "GIG", name: "Galeão" },
      { iata: "SDU", name: "Santos Dumont" },
    ],
  },
  {
    iata: "BUE",
    name: "Buenos Aires",
    country: "Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    airports: [
      { iata: "EZE", name: "Ezeiza" },
      { iata: "AEP", name: "Aeroparque" },
    ],
  },
  {
    iata: "OSA",
    name: "Osaka",
    country: "Japan",
    latitude: 34.6937,
    longitude: 135.5023,
    airports: [
      { iata: "KIX", name: "Kansai" },
      { iata: "ITM", name: "Itami" },
    ],
  },
  {
    iata: "IST",
    name: "Istanbul",
    country: "Türkiye",
    latitude: 41.0082,
    longitude: 28.9784,
    airports: [
      { iata: "IST", name: "Istanbul" },
      { iata: "SAW", name: "Sabiha Gökçen" },
    ],
  },
  {
    iata: "MOW",
    name: "Moscow",
    country: "Russia",
    latitude: 55.7558,
    longitude: 37.6173,
    airports: [
      { iata: "SVO", name: "Sheremetyevo" },
      { iata: "DME", name: "Domodedovo" },
      { iata: "VKO", name: "Vnukovo" },
    ],
  },
  {
    iata: "JKT",
    name: "Jakarta",
    country: "Indonesia",
    latitude: -6.2088,
    longitude: 106.8456,
    airports: [
      { iata: "CGK", name: "Soekarno–Hatta" },
      { iata: "HLP", name: "Halim Perdanakusuma" },
    ],
  },
  {
    iata: "STO",
    name: "Stockholm",
    country: "Sweden",
    latitude: 59.3293,
    longitude: 18.0686,
    airports: [
      { iata: "ARN", name: "Arlanda" },
      { iata: "BMA", name: "Bromma" },
      { iata: "NYO", name: "Skavsta" },
      { iata: "VST", name: "Västerås" },
    ],
  },
  {
    iata: "BER",
    name: "Berlin",
    country: "Germany",
    latitude: 52.52,
    longitude: 13.405,
    airports: [{ iata: "BER", name: "Brandenburg" }],
  },
];

export function metrosMatching(query: string): AirportMetro[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return AIRPORT_METROS.filter((m) => {
    const name = m.name.toLowerCase();
    if (name.startsWith(q)) return true;
    if (m.iata.toLowerCase() === q) return true;
    if (m.iata.toLowerCase().startsWith(q) && q.length >= 2) return true;
    return false;
  });
}
