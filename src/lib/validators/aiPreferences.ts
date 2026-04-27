import { z } from "zod";
import type { AiPreferences } from "@/lib/types";

/**
 * Zod schema for `AiPreferences`. Lives outside any `"use server"` module
 * because Next.js only allows async function exports from server-action
 * files. Both `lockAndStartDraft` (destinations.ts) and
 * `updateTripPreferences` (tripPreferences.ts) import this.
 */
export const preferencesSchema: z.ZodType<AiPreferences> = z.object({
  origin: z
    .object({
      name: z.string(),
      address: z.string().nullable(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      placeId: z.string().nullable(),
      metro: z.string().nullable().optional(),
      metroAirports: z.array(z.string()).nullable().optional(),
    })
    .nullable(),
  crew_size: z.number().int().min(1).max(50),
  budget_tier: z.enum(["tight", "mid", "lavish", "custom"]),
  budget_custom_pp: z.number().nullable(),
  vibes: z.array(
    z.enum([
      "chill",
      "active",
      "adventure",
      "sport",
      "beach",
      "mountains",
      "nature",
      "city",
      "foodie",
      "street_food",
      "wine",
      "party",
      "bars",
      "live_music",
      "art",
      "history",
      "architecture",
      "romantic",
      "family_friendly",
      "luxury",
      "wellness",
      "photogenic",
    ]),
  ),
  occasion: z
    .enum([
      "group_holiday",
      "birthday",
      "anniversary",
      "honeymoon",
      "babymoon",
      "engagement",
      "hen_do",
      "stag_do",
      "family",
      "graduation",
      "reunion",
      "corporate_retreat",
      "guys_trip",
      "girls_trip",
      "couples_trip",
    ])
    .optional(),
  notes: z.string().max(400).optional(),
  pins: z
    .array(
      z.object({
        title: z.string().max(120),
        when: z.string().max(80).nullable(),
        date: z.string().nullable(),
        priority: z.enum(["must", "nice"]),
        notes: z.string().max(300).nullable(),
      }),
    )
    .max(5)
    .optional(),
});
