import { z } from "zod";

const ScheduleItemPlaceSchema = z.object({
  name: z.string().min(2).max(80),
});

const PlaceListSchema = z.preprocess(
  (raw) => (raw == null ? [] : raw),
  z.array(ScheduleItemPlaceSchema).max(4),
);

export const DraftActivitySchema = z.object({
  placeId: z.string().optional(),
  name: z.string(),
  description: z.string(),
  approxDurationMinutes: z.number().int().positive().optional(),
  bookAhead: z.boolean().default(false),
  googleMapsUrl: z.string().url().optional(),
});

// Permissive: Gemini occasionally returns bookAhead items as objects
// with fields it picked itself ({ title, details } / { activity, body }
// / etc.), or even arrays of strings, or empty objects. Coerce
// anything-vaguely-string-shaped into a usable {name, description} so
// Pioneers don't see a draft fail because the model labelled a field
// "title" instead of "name". Zod's preprocess runs before parse so the
// downstream object schema sees a valid shape.
const DraftActivityLikeSchema = z.preprocess(
  (raw) => {
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return { name: trimmed, description: trimmed, bookAhead: true };
    }
    if (raw === null || typeof raw !== "object") {
      return { name: "Booking", description: "Book ahead", bookAhead: true };
    }
    const r = raw as Record<string, unknown>;
    const pickStr = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = r[key];
        if (typeof value === "string" && value.trim().length > 0) return value.trim();
      }
      return undefined;
    };
    const name =
      pickStr("name", "title", "activity", "label", "heading") ?? "Booking";
    const description =
      pickStr("description", "details", "body", "note", "summary", "info") ??
      name;
    const out: Record<string, unknown> = {
      ...r,
      name,
      description,
      bookAhead: typeof r.bookAhead === "boolean" ? r.bookAhead : true,
    };
    return out;
  },
  DraftActivitySchema,
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
  places: PlaceListSchema,
});

export const SetupActivitySchema = z.object({
  title: z.string().min(1).max(80),
  meta: z.string().max(60).optional(),
  category: z.enum(["day", "night"]),
});

export const SetupBookingSchema = z.object({
  title: z.string().min(1).max(100),
  place_name: z.string().min(2).max(80).optional(),
});

export const SetupSchema = z.object({
  heroTitle: z.string().min(1).max(80),
  heroSubtitle: z.string().min(1).max(300),
  cityLabel: z.string().min(1).max(80),
  datesLabel: z.string().min(1).max(60),
  // Take whatever Gemini gives — pad to 4 cells in the validator below
  // rather than rejecting the whole draft if it returned 3.
  specGrid: z.array(SetupSpecCellSchema).min(1).max(8),
  schedule: z.array(SetupScheduleRowSchema).min(1).max(14),
  // Floors lowered: we'd rather render fewer items than fail the draft.
  activities: z.array(SetupActivitySchema).min(3).max(24),
  bookings: z.array(SetupBookingSchema).min(1).max(16),
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
      neighbourhood: z.string().min(2).max(80),
      description: z.string().min(2).max(300),
      bestFor: z.string().min(2).max(60),
    }),
  ).max(5),
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
