import { z } from "zod";

export const DraftHotelSuggestionSchema = z.object({
  area: z.string(),
  description: z.string(),
  searchUrl: z.string().url(),
});

export const DraftActivitySchema = z.object({
  placeId: z.string().optional(),
  name: z.string(),
  description: z.string(),
  approxDurationMinutes: z.number().int().positive().optional(),
  bookAhead: z.boolean().default(false),
  googleMapsUrl: z.string().url().optional(),
});

const DraftActivityLikeSchema = z
  .union([DraftActivitySchema, z.string()])
  .transform((value) =>
    typeof value === "string"
      ? {
          name: value,
          description: value,
          bookAhead: true,
        }
      : value,
  );

export const DraftDayBlockSchema = z.object({
  period: z.enum(["morning", "afternoon", "evening"]),
  title: z.string(),
  activities: z.array(DraftActivitySchema),
  notes: z.string().optional(),
});

export const DraftDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string(),
  theme: z.string(),
  blocks: z.array(DraftDayBlockSchema),
});

export const DraftBudgetSchema = z.object({
  perPersonGBP: z.object({
    flightsLow: z.number(),
    flightsHigh: z.number(),
    accommodationLow: z.number(),
    accommodationHigh: z.number(),
    foodLow: z.number(),
    foodHigh: z.number(),
    activitiesLow: z.number(),
    activitiesHigh: z.number(),
  }),
  caveats: z.array(z.string()),
});

export const SetupSpecCellSchema = z.object({
  label: z.string().min(1).max(30),
  value: z.string().min(1).max(80),
  sub: z.string().max(60),
  amount: z.number().finite().min(0).max(10_000_000).nullable().optional(),
});

export const SetupScheduleRowSchema = z.object({
  day_label: z.string().min(1).max(30),
  heading: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
});

export const SetupActivitySchema = z.object({
  title: z.string().min(1).max(80),
  meta: z.string().max(60).optional(),
  category: z.enum(["day", "night"]),
});

export const SetupBookingSchema = z.object({
  title: z.string().min(1).max(100),
});

export const SetupSchema = z.object({
  heroTitle: z.string().min(1).max(80),
  heroSubtitle: z.string().min(1).max(300),
  cityLabel: z.string().min(1).max(80),
  datesLabel: z.string().min(1).max(60),
  specGrid: z.array(SetupSpecCellSchema).length(4),
  schedule: z.array(SetupScheduleRowSchema).min(1).max(10),
  activities: z.array(SetupActivitySchema).min(6).max(20),
  bookings: z.array(SetupBookingSchema).min(3).max(12),
});

export const EnrichedDraftSchema = z.object({
  tier: z.literal("enriched"),
  destination: z.string(),
  summary: z.string(),
  weather: z
    .object({
      description: z.string(),
      averageHighC: z.number(),
      averageLowC: z.number(),
    })
    .nullable(),
  whereToStay: z.array(
    z.object({
      neighbourhood: z.string(),
      description: z.string(),
      bestFor: z.string(),
      hotelSuggestions: z.array(DraftHotelSuggestionSchema),
    }),
  ),
  itinerary: z.array(DraftDaySchema),
  bookAhead: z.array(DraftActivityLikeSchema),
  budget: DraftBudgetSchema,
  flightSearchUrl: z.string().url(),
  setup: SetupSchema,
  generatedAt: z.string(),
});

export const BasicDraftSchema = z.object({
  tier: z.literal("basic"),
  destination: z.string(),
  summary: z.string(),
  themes: z.array(z.string()),
  generalTips: z.array(z.string()),
  upgradePrompt: z.string(),
  generatedAt: z.string(),
});

export type EnrichedDraft = z.infer<typeof EnrichedDraftSchema>;
export type BasicDraft = z.infer<typeof BasicDraftSchema>;
export type Draft = EnrichedDraft | BasicDraft;
export type DraftSetup = z.infer<typeof SetupSchema>;
export type DraftSetupSpecCell = z.infer<typeof SetupSpecCellSchema>;
export type DraftSetupScheduleRow = z.infer<typeof SetupScheduleRowSchema>;
export type DraftSetupActivity = z.infer<typeof SetupActivitySchema>;
export type DraftSetupBooking = z.infer<typeof SetupBookingSchema>;
