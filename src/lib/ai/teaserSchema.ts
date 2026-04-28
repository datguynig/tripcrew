import { z } from "zod";

const dayBlockSchema = z.object({
  day: z.string().min(1).max(40),
  place: z.string().min(1).max(80),
  note: z.string().min(1).max(280),
});

export const teaserOutputSchema = z.object({
  spec: z.object({
    perHead: z.string().min(1).max(20),
    crew: z.string().min(1).max(20),
    origin: z.string().min(1).max(20),
    vibes: z.string().min(1).max(60),
  }),
  hero_paragraph: z.string().min(40).max(280),
  days: z.array(dayBlockSchema).length(2),
  stay: z.object({
    neighbourhood: z.string().min(1).max(40),
    priceBand: z.string().min(1).max(40),
  }),
  flights: z.object({
    priceBand: z.string().min(1).max(80),
  }),
  bookings_count: z.number().int().nonnegative().max(99),
  weather: z.string().min(1).max(200),
});

export type TeaserOutput = z.infer<typeof teaserOutputSchema>;

export function parseTeaserOutput(raw: unknown) {
  return teaserOutputSchema.parse(raw);
}
