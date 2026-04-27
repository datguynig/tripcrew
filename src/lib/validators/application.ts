import { z } from "zod";

export const applicationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email.");

// Enums must mirror the check constraints in
// supabase/migrations/20260429000000_applications_table.sql AND the
// string unions in src/lib/types.ts. Three sources of truth — drift risk.
export const applicationAnswersSchema = z.object({
  trips_per_year: z.enum(["0", "1", "2-3", "4+"]),
  role: z.enum(["organiser", "attendee", "depends"]),
  pain: z.enum(["dates", "booking", "money", "plan", "chaos"]),
  budget_attitude: z.enum(["monopoly", "splurge", "count", "depends"]),
});

export const fullApplicationSchema = applicationAnswersSchema.extend({
  email: applicationEmailSchema,
  utm_source: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  referrer: z.string().max(2048).optional(),
});

export type ApplicationAnswers = z.infer<typeof applicationAnswersSchema>;
export type FullApplicationInput = z.infer<typeof fullApplicationSchema>;
