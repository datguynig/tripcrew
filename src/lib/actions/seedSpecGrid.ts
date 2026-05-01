import {
  OCCASION_LABELS,
  VIBE_LABELS,
  type AiOriginAirport,
  type AiPreferences,
  type SpecItem,
} from "@/lib/types";

// Prefer a short, recognisable origin label over the full airport
// name. Order: metro IATA (LON / NYC) → IATA-in-parens from the name
// ("London Heathrow (LHR)" → "LHR") → first word of the name as a
// last resort. Returns null if no origin is set.
function formatOriginShort(origin: AiOriginAirport | null): string | null {
  if (!origin) return null;
  const metro = origin.metro?.trim();
  if (metro) return metro.toUpperCase();
  const name = origin.name?.trim();
  if (!name) return null;
  const parenIata = name.match(/\(([A-Z]{3})\)/);
  if (parenIata) return parenIata[1];
  // Take the first word and truncate; "London Heathrow Airport"
  // becomes "London", which is more useful than the full string.
  const firstWord = name.split(/\s+/)[0];
  return firstWord.slice(0, 24);
}

const TIER_LABEL: Record<string, string> = {
  tight: "Tight",
  mid: "Mid",
  lavish: "Lavish",
  custom: "Custom",
};

function currencySymbol(code: string | null | undefined): string {
  switch ((code ?? "GBP").toUpperCase()) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return "";
  }
}

/**
 * Build a 4-cell spec grid from the dialog answers + trip context, so
 * the brief is meaningful immediately after Lock & save — instead of
 * sitting empty until the AI draft runs. The AI draft can later refine
 * any cell (and admins can inline-edit at any time).
 */
export function seedSpecGridFromPrefs({
  prefs,
  destination,
  datesLabel,
  budgetPp,
  currency,
}: {
  prefs: AiPreferences;
  destination: string | null;
  datesLabel: string | null;
  budgetPp: number | null;
  currency: string | null;
}): SpecItem[] {
  const cur = currencySymbol(currency);

  const baseValue = destination?.trim() || "Destination TBD";
  const baseSub = datesLabel?.trim() || "Dates TBD";

  const originDisplay = formatOriginShort(prefs.origin);
  const flightsValue = originDisplay ? `From ${originDisplay}` : "Origin TBD";
  const flightsSub = originDisplay
    ? "Search flights"
    : "Add an origin airport";

  const perHeadValue =
    budgetPp !== null && budgetPp > 0
      ? `${cur}${budgetPp.toLocaleString()}pp`
      : "Budget TBD";
  const perHeadSub = TIER_LABEL[prefs.budget_tier] ?? "Per person";

  const occasionLabel = prefs.occasion ? OCCASION_LABELS[prefs.occasion] : null;
  const vibesShort = prefs.vibes
    .slice(0, 2)
    .map((v) => VIBE_LABELS[v])
    .join(" · ");
  const ruleValue = occasionLabel || vibesShort || "Group trip";
  // Sub line prioritises pinned moments (the most concrete commitment
  // a crew makes) over free-text notes. Falls back to notes, then a
  // generic placeholder.
  const pinCount = prefs.pins?.length ?? 0;
  const pinSub =
    pinCount === 1
      ? "1 pinned moment"
      : pinCount > 1
        ? `${pinCount} pinned moments`
        : null;
  const ruleSub =
    pinSub ?? ((prefs.notes ?? "").slice(0, 60).trim() || "Vibe and intent");

  return [
    {
      label: "BASE",
      value: baseValue.slice(0, 80),
      sub: baseSub.slice(0, 60),
    },
    {
      label: "FLIGHTS",
      value: flightsValue.slice(0, 80),
      sub: flightsSub.slice(0, 60),
    },
    {
      label: "PER HEAD",
      value: perHeadValue.slice(0, 80),
      sub: perHeadSub.slice(0, 60),
      amount: budgetPp !== null && budgetPp > 0 ? budgetPp : null,
    },
    {
      label: "THE RULE",
      value: ruleValue.slice(0, 80),
      sub: ruleSub.slice(0, 60),
    },
  ];
}
