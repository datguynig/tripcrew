import {
  OCCASION_LABELS,
  VIBE_LABELS,
  type AiPreferences,
  type SpecItem,
} from "@/lib/types";

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

  const originName = prefs.origin?.name?.trim();
  const flightsValue = originName
    ? `From ${originName}`
    : "Origin TBD";
  const flightsSub = originName ? "Search flights" : "Add an origin airport";

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
  const ruleSub = (prefs.notes ?? "").slice(0, 60).trim() || "Vibe and intent";

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
