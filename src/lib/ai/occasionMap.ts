import type { AiOccasion } from "@/lib/types";

/**
 * Per-occasion prompt instruction. Same shape as VIBE_INSTRUCTIONS but
 * narrower — occasions don't add Places queries because the *kind* of
 * places to fetch is already covered by the vibes axis. Occasion only
 * shapes tone, framing, and which types of venues to favour from the
 * data we already pulled.
 */
export const OCCASION_INSTRUCTIONS: Record<AiOccasion, string> = {
  group_holiday:
    "Plan for a group of friends. Casual, shared experiences. Avoid couples-only or formal-only venues.",
  guys_trip:
    "Lean casual: sports, beers, kebabs over Michelin, low-key central stays. Skip floral spas and couples-y restaurants.",
  girls_trip:
    "Lean towards good food, photogenic spots, brunches, cocktail bars, optional spa/wellness. Avoid sports-bar default.",
  couples_trip:
    "Two-person dynamic: small intimate restaurants, walkable evenings, no group-of-six logistics.",
  birthday:
    "Headline one evening as the birthday dinner. Book a standout restaurant from the data. The schedule's other days warm up to it.",
  anniversary:
    "One romantic standout (restaurant with a view, sunset moment, or intimate booking), anchored on the day closest to the anniversary date if known.",
  honeymoon:
    "Always-couples, intimate, romantic. No big-group venues. Pick the most scenic neighbourhood for the stay.",
  babymoon:
    "Slow pace, no alcohol-led evenings, no high-altitude or strenuous activity. Comfort-first dining and lodging.",
  engagement:
    "One romantic anchor moment (sunset, viewpoint, intimate dinner). Otherwise plays like a couple's holiday.",
  hen_do:
    "Group of women celebrating: brunch, photogenic spots, an organised activity (cocktail class, day at a beach club), one big night out.",
  stag_do:
    "Group of men celebrating: sport, beers, casual food, one big night out. Avoid spa/wellness defaults.",
  family:
    "Multi-generational. Every block must be accessible to kids and grandparents. Sensible bedtimes, no late nights, casual dining.",
  graduation:
    "Group of friends post-graduation: energetic, budget-aware, celebratory. Mix one big night out with cultural daytime.",
  reunion:
    "Group catching up: relaxed, conversation-friendly venues over loud ones. Long lunches, scenic walks, one shared standout dinner.",
  corporate_retreat:
    "Mix of work-mode and bonding. Block out one half-day for activity, one for free time. Book a private dining room one evening.",
};

export function occasionPromptLine(
  occasion: AiOccasion | undefined,
): string {
  if (!occasion) return "";
  return OCCASION_INSTRUCTIONS[occasion] ?? "";
}
