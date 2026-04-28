import { z } from "zod";

export const teaserInputsSchema = z.object({
  origin: z
    .string()
    .regex(/^[A-Z]{3}$/u, "Origin must be a 3-letter IATA code")
    .transform((v) => v.toUpperCase()),
  crew: z.enum(["2", "3-4", "5-6", "7+"]),
  when: z.enum(["weekend", "week", "two-weeks", "flexible"]),
  budget: z.enum(["500", "1000", "1500", "2000+"]),
});

export const teaserSubmissionSchema = teaserInputsSchema.extend({
  email: z.string().email("Enter a valid email").max(254),
  slug: z.string().min(1).max(64),
});

export type TeaserSubmission = z.infer<typeof teaserSubmissionSchema>;

export function normalizeTeaserInputs(input: z.infer<typeof teaserInputsSchema>): string {
  return JSON.stringify({
    origin: input.origin,
    crew: input.crew,
    when: input.when,
    budget: input.budget,
  });
}
