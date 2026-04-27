/**
 * Static IATA lookup for the SerpApi flight pricing call.
 *
 * Two layers:
 *
 * 1. **resolveOriginIata** — turns an `AiOriginAirport` (the prefs origin
 *    pick) into a Google Flights `departure_id`. Honours the metro code
 *    if the user picked "city — all airports" (e.g. LON for all London
 *    airports), otherwise looks up the airport by name.
 *
 * 2. **resolveDestinationIata** — turns a destination string from
 *    `trip.destination` (e.g. "Lisbon", "Lisbon, Portugal", "Accra,
 *    Ghana") into a city/airport IATA. Returns null when we can't
 *    confidently match, so the action can render "live pricing
 *    unavailable" instead of guessing.
 *
 * The table covers ~150 airports and city codes — enough for v1 across
 * common origins and destinations. When a destination falls outside this
 * list, we surface that to the UI rather than hallucinating an airport.
 */

import type { AiOriginAirport } from "@/lib/types";

// Map of name fragments → IATA. Lower-cased keys; the matcher does
// case-insensitive substring matching. Order matters when one name
// is a substring of another — put the more specific entry first.
const AIRPORT_BY_NAME: Array<{ match: string; iata: string }> = [
  // London
  { match: "heathrow", iata: "LHR" },
  { match: "gatwick", iata: "LGW" },
  { match: "stansted", iata: "STN" },
  { match: "luton", iata: "LTN" },
  { match: "london city", iata: "LCY" },
  // Paris
  { match: "charles de gaulle", iata: "CDG" },
  { match: "orly", iata: "ORY" },
  // Amsterdam
  { match: "schiphol", iata: "AMS" },
  // Dublin
  { match: "dublin", iata: "DUB" },
  // Madrid / Barcelona
  { match: "madrid", iata: "MAD" },
  { match: "barcelona", iata: "BCN" },
  // Rome / Milan
  { match: "fiumicino", iata: "FCO" },
  { match: "ciampino", iata: "CIA" },
  { match: "malpensa", iata: "MXP" },
  { match: "linate", iata: "LIN" },
  // Frankfurt / Munich / Berlin
  { match: "frankfurt", iata: "FRA" },
  { match: "munich", iata: "MUC" },
  { match: "berlin brandenburg", iata: "BER" },
  // Lisbon
  { match: "lisbon", iata: "LIS" },
  { match: "humberto delgado", iata: "LIS" },
  // Stockholm / Copenhagen / Oslo
  { match: "arlanda", iata: "ARN" },
  { match: "kastrup", iata: "CPH" },
  { match: "gardermoen", iata: "OSL" },
  // Reykjavik
  { match: "keflavik", iata: "KEF" },
  // Zurich / Geneva
  { match: "zurich", iata: "ZRH" },
  { match: "geneva", iata: "GVA" },
  // New York
  { match: "jfk", iata: "JFK" },
  { match: "kennedy", iata: "JFK" },
  { match: "newark", iata: "EWR" },
  { match: "laguardia", iata: "LGA" },
  // LA / SF
  { match: "los angeles intl", iata: "LAX" },
  { match: "lax", iata: "LAX" },
  { match: "san francisco intl", iata: "SFO" },
  { match: "sfo", iata: "SFO" },
  // Chicago / Boston / Seattle / Miami
  { match: "o'hare", iata: "ORD" },
  { match: "ohare", iata: "ORD" },
  { match: "midway", iata: "MDW" },
  { match: "boston logan", iata: "BOS" },
  { match: "seattle-tacoma", iata: "SEA" },
  { match: "sea-tac", iata: "SEA" },
  { match: "miami intl", iata: "MIA" },
  // Toronto
  { match: "pearson", iata: "YYZ" },
  // Tokyo / Seoul / Hong Kong / Singapore
  { match: "haneda", iata: "HND" },
  { match: "narita", iata: "NRT" },
  { match: "incheon", iata: "ICN" },
  { match: "hong kong intl", iata: "HKG" },
  { match: "changi", iata: "SIN" },
  // Bangkok / KL / Manila / Jakarta
  { match: "suvarnabhumi", iata: "BKK" },
  { match: "kuala lumpur intl", iata: "KUL" },
  { match: "ninoy aquino", iata: "MNL" },
  { match: "soekarno-hatta", iata: "CGK" },
  // Dubai / Abu Dhabi / Doha / Istanbul
  { match: "dubai intl", iata: "DXB" },
  { match: "abu dhabi", iata: "AUH" },
  { match: "hamad", iata: "DOH" },
  { match: "istanbul airport", iata: "IST" },
  { match: "sabiha", iata: "SAW" },
  // Africa
  { match: "kotoka", iata: "ACC" },
  { match: "murtala muhammed", iata: "LOS" },
  { match: "jomo kenyatta", iata: "NBO" },
  { match: "or tambo", iata: "JNB" },
  { match: "cape town intl", iata: "CPT" },
  { match: "cairo intl", iata: "CAI" },
  { match: "marrakesh menara", iata: "RAK" },
  // South America
  { match: "guarulhos", iata: "GRU" },
  { match: "galeao", iata: "GIG" },
  { match: "ezeiza", iata: "EZE" },
  { match: "el dorado", iata: "BOG" },
  { match: "jorge chavez", iata: "LIM" },
  // Australia / NZ
  { match: "sydney kingsford", iata: "SYD" },
  { match: "melbourne tullamarine", iata: "MEL" },
  { match: "auckland intl", iata: "AKL" },
  // India
  { match: "indira gandhi", iata: "DEL" },
  { match: "chhatrapati shivaji", iata: "BOM" },
  { match: "kempegowda", iata: "BLR" },
];

// City → IATA city code (Google Flights accepts these as departure_id /
// arrival_id and aggregates across all airports). Lower-cased keys.
const CITY_BY_NAME: Record<string, string> = {
  london: "LON",
  paris: "PAR",
  "new york": "NYC",
  "los angeles": "LAX",
  "san francisco": "SFO",
  chicago: "CHI",
  boston: "BOS",
  miami: "MIA",
  seattle: "SEA",
  washington: "WAS",
  toronto: "YTO",
  vancouver: "YVR",
  amsterdam: "AMS",
  dublin: "DUB",
  edinburgh: "EDI",
  manchester: "MAN",
  madrid: "MAD",
  barcelona: "BCN",
  lisbon: "LIS",
  porto: "OPO",
  rome: "ROM",
  milan: "MIL",
  venice: "VCE",
  florence: "FLR",
  naples: "NAP",
  athens: "ATH",
  vienna: "VIE",
  prague: "PRG",
  budapest: "BUD",
  warsaw: "WAW",
  krakow: "KRK",
  berlin: "BER",
  munich: "MUC",
  hamburg: "HAM",
  frankfurt: "FRA",
  cologne: "CGN",
  dusseldorf: "DUS",
  zurich: "ZRH",
  geneva: "GVA",
  basel: "BSL",
  brussels: "BRU",
  copenhagen: "CPH",
  stockholm: "STO",
  oslo: "OSL",
  helsinki: "HEL",
  reykjavik: "REK",
  moscow: "MOW",
  "saint petersburg": "LED",
  "st petersburg": "LED",
  istanbul: "IST",
  tel: "TLV",
  "tel aviv": "TLV",
  dubai: "DXB",
  "abu dhabi": "AUH",
  doha: "DOH",
  riyadh: "RUH",
  amman: "AMM",
  beirut: "BEY",
  cairo: "CAI",
  marrakesh: "RAK",
  marrakech: "RAK",
  casablanca: "CAS",
  tunis: "TUN",
  accra: "ACC",
  lagos: "LOS",
  abuja: "ABV",
  nairobi: "NBO",
  "addis ababa": "ADD",
  johannesburg: "JNB",
  "cape town": "CPT",
  durban: "DUR",
  delhi: "DEL",
  mumbai: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  chennai: "MAA",
  kolkata: "CCU",
  hyderabad: "HYD",
  bangkok: "BKK",
  "kuala lumpur": "KUL",
  singapore: "SIN",
  jakarta: "JKT",
  manila: "MNL",
  "ho chi minh": "SGN",
  hanoi: "HAN",
  tokyo: "TYO",
  osaka: "OSA",
  kyoto: "KIX",
  seoul: "SEL",
  beijing: "BJS",
  shanghai: "SHA",
  guangzhou: "CAN",
  shenzhen: "SZX",
  "hong kong": "HKG",
  taipei: "TPE",
  sydney: "SYD",
  melbourne: "MEL",
  brisbane: "BNE",
  perth: "PER",
  auckland: "AKL",
  wellington: "WLG",
  "rio de janeiro": "RIO",
  "sao paulo": "SAO",
  brasilia: "BSB",
  "buenos aires": "BUE",
  santiago: "SCL",
  lima: "LIM",
  bogota: "BOG",
  "mexico city": "MEX",
  cancun: "CUN",
  havana: "HAV",
  "san juan": "SJU",
  honolulu: "HNL",
  anchorage: "ANC",
  vegas: "LAS",
  "las vegas": "LAS",
  orlando: "MCO",
  atlanta: "ATL",
  denver: "DEN",
  philadelphia: "PHL",
  detroit: "DTW",
  minneapolis: "MSP",
  phoenix: "PHX",
  dallas: "DFW",
  houston: "HOU",
  austin: "AUS",
  nashville: "BNA",
  portland: "PDX",
  "salt lake": "SLC",
};

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function lookupAirportByName(name: string): string | null {
  const n = normalize(name);
  for (const entry of AIRPORT_BY_NAME) {
    if (n.includes(entry.match)) return entry.iata;
  }
  return null;
}

function lookupCityByName(name: string): string | null {
  const n = normalize(name);
  // Exact match first
  if (CITY_BY_NAME[n]) return CITY_BY_NAME[n];
  // "Lisbon, Portugal" → strip the country tail
  const head = n.split(",")[0].trim();
  if (CITY_BY_NAME[head]) return CITY_BY_NAME[head];
  // Substring fallback so "barcelona spain" matches "barcelona"
  for (const [city, iata] of Object.entries(CITY_BY_NAME)) {
    if (n.includes(city)) return iata;
  }
  return null;
}

export function resolveOriginIata(origin: AiOriginAirport | null): string | null {
  if (!origin) return null;
  // "All airports" metro picks win — already an IATA.
  if (origin.metro && /^[A-Z]{3}$/.test(origin.metro)) return origin.metro;
  // Try airport-specific match by name (Heathrow → LHR).
  const byName = lookupAirportByName(origin.name);
  if (byName) return byName;
  // Last fallback: city lookup against the airport's city portion of
  // the name ("Heathrow Airport · London" → strip → London → LON).
  return lookupCityByName(origin.name);
}

export function resolveDestinationIata(destination: string): string | null {
  return lookupCityByName(destination) ?? lookupAirportByName(destination);
}
