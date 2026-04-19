/**
 * AI wrapper for the "Lock & draft" flow.
 *
 * Exposes one high-level function, draftTrip, that takes a trip
 * context and returns a full draft (hero, spec grid, schedule,
 * activities, bookings) grounded in real venues via Google Places.
 *
 * Provider: Gemini 3 Flash Preview via @google/genai. The interface
 * is provider-agnostic — swapping to Claude Haiku later is a drop-in
 * change in callGemini(). Keep the Gemini specifics contained.
 *
 * Flow:
 *  1. Open a generateContent loop with the searchPlaces function tool
 *  2. Each iteration, either Gemini emits a searchPlaces call (we
 *     execute via src/lib/places.ts and feed the result back) OR it
 *     emits the final JSON draft
 *  3. Zod-validate the final JSON; return with usage telemetry
 *
 * Never import this from a "use client" file — requires GEMINI_API_KEY.
 */

import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
} from "@google/genai";
import { z } from "zod";
import { searchText } from "@/lib/places";

// --- Zod schema (authoritative shape for a draft) --------------------------

const SpecCellSchema = z.object({
  label: z.string().min(1).max(30),
  value: z.string().min(1).max(80),
  sub: z.string().max(60),
});

const ScheduleRowSchema = z.object({
  day_label: z.string().min(1).max(30),
  heading: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
});

const ActivitySchema = z.object({
  title: z.string().min(1).max(80),
  meta: z.string().max(60),
  category: z.enum(["day", "night"]),
});

const BookingSchema = z.object({
  title: z.string().min(1).max(100),
});

export const TripDraftSchema = z.object({
  hero_title: z.string().min(1).max(80),
  hero_subtitle: z.string().min(1).max(300),
  spec_grid: z.array(SpecCellSchema).length(4),
  schedule: z.array(ScheduleRowSchema).min(1).max(10),
  activities: z.array(ActivitySchema).min(6).max(20),
  bookings: z.array(BookingSchema).min(3).max(12),
});

export type TripDraft = z.infer<typeof TripDraftSchema>;
export type SpecCell = z.infer<typeof SpecCellSchema>;
export type ScheduleRow = z.infer<typeof ScheduleRowSchema>;
export type ActivityBrief = z.infer<typeof ActivitySchema>;
export type BookingBrief = z.infer<typeof BookingSchema>;

export type DraftSurface = "spec_grid" | "schedule" | "activities" | "bookings";

const SpecGridOnlySchema = z.object({
  spec_grid: z.array(SpecCellSchema).length(4),
});
const ScheduleOnlySchema = z.object({
  schedule: z.array(ScheduleRowSchema).min(1).max(10),
});
const ActivitiesOnlySchema = z.object({
  activities: z.array(ActivitySchema).min(6).max(20),
});
const BookingsOnlySchema = z.object({
  bookings: z.array(BookingSchema).min(3).max(12),
});

// --- Input / output types --------------------------------------------------

export type DraftContext = {
  destination: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  startDate: string | null; // ISO date
  endDate: string | null;
  crewSize: number;
  budgetPerHead: number | null;
  currency: string;
  topVotedShortlist?: string[];
  origin?: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  budgetTier?: "tight" | "mid" | "lavish" | "custom" | null;
  vibes?: string[];
};

export type DraftUsage = {
  provider: "gemini" | "claude";
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  aiCostUsd: number;
  placesRequests: number;
  placesCostUsd: number;
  totalCostUsd: number;
};

export type DraftResult = {
  draft: TripDraft;
  usage: DraftUsage;
};

export function aiEnabled(): boolean {
  return (process.env.GEMINI_API_KEY ?? "").length > 0;
}

// --- Gemini implementation -------------------------------------------------

const MODEL = "gemini-3-flash-preview";

// Per token pricing in USD. As of April 2026. Update if Google shifts.
// Thinking tokens are billed as output.
const GEMINI_INPUT_USD_PER_TOKEN = 0.5 / 1_000_000;
const GEMINI_OUTPUT_USD_PER_TOKEN = 3 / 1_000_000;

// Places (New) Text Search: $17 / 1000 requests.
const PLACES_SEARCH_USD_PER_REQUEST = 17 / 1000;

const MAX_TOOL_ITERATIONS = 12;
const MAX_PLACES_REQUESTS = 20;

const SYSTEM_PROMPT = [
  "You are the trip-planning assistant for Tripcrew, a collaborative",
  "group-trip app. A crew just locked a destination. Draft the trip so",
  "it feels alive in one click — hero copy, logistics, a day-by-day",
  "schedule, activity shortlist, and bookings the crew should make.",
  "",
  "Rules:",
  "- Ground every specific venue in a real place via the searchPlaces",
  "  tool. Call it with tight queries like \"rooftop bar Lisbon Alfama\",",
  "  \"seafood restaurant Belem\", \"kayak rental Stockholm archipelago\".",
  "  Never invent venue names you haven't verified.",
  "- Prefer mid-budget, locally loved over tourist traps. Match the",
  "  crew's stated budget per head.",
  "- Voice: tight, editorial, confident. Short sentences. No filler,",
  "  no \"embark on an unforgettable journey\" prose. Think Monocle,",
  "  not AirTravel Weekly.",
  "- Schedule: one row per trip day (inferred from start + end date)",
  "  with a heading and a 1–3 sentence body. Name specific venues in",
  "  the body; order them by time of day.",
  "- Activities: mix day + night; 10–15 items total. Include specific",
  "  named venues from searchPlaces. `meta` is an all-caps mono label",
  "  like \"2H · €35\".",
  "- Bookings: 5–10 actionable items the crew needs to reserve or book",
  "  in advance (e.g. \"Book Michelin dinner at Belcanto Fri night\").",
  "- Spec grid: exactly 4 cells. Suggested labels: \"Base\" (where they",
  "  sleep), \"Flights\" (route + duration), \"Per head\" (budget value),",
  "  \"The rule\" (a single destination-specific constraint, e.g.",
  "  \"Systembolaget by Fri 3pm\" for Stockholm).",
  "",
  "Output: when you have enough information, respond with a SINGLE",
  "JSON object matching this exact shape, nothing else — no prose",
  "before or after:",
  "",
  "{",
  '  "hero_title": string (≤80 chars, e.g. "Lisbon"),',
  '  "hero_subtitle": string (≤300 chars, one paragraph, editorial),',
  '  "spec_grid": [ { "label": string, "value": string, "sub": string }, ... × 4 ],',
  '  "schedule": [ { "day_label": string, "heading": string, "body": string }, ... ],',
  '  "activities": [ { "title": string, "meta": string, "category": "day"|"night" }, ... ],',
  '  "bookings": [ { "title": string }, ... ]',
  "}",
].join("\n");

const SEARCH_PLACES_TOOL = {
  name: "searchPlaces",
  description:
    "Find real venues near the trip destination. Use short, specific queries like 'rooftop bar Alfama' or 'seafood Belem'. Returns up to 6 venues per call.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          "Free-text query. Include venue type and neighbourhood where useful.",
      },
    },
    required: ["query"],
  },
};

function buildUserPrompt(ctx: DraftContext): string {
  const lines = [
    `destination: ${ctx.destination}`,
    `start_date: ${ctx.startDate ?? "TBD"}`,
    `end_date: ${ctx.endDate ?? "TBD"}`,
    `crew_size: ${ctx.crewSize}`,
    `budget_per_head: ${
      ctx.budgetPerHead !== null ? `${ctx.budgetPerHead} ${ctx.currency}` : "unset"
    }`,
  ];
  if (ctx.budgetTier) {
    lines.push(`budget_tier: ${ctx.budgetTier}`);
  }
  if (ctx.origin?.name) {
    const parts = [ctx.origin.name];
    if (ctx.origin.address) parts.push(`(${ctx.origin.address})`);
    lines.push(`origin_airport: ${parts.join(" ")}`);
    lines.push(
      "Use this as the departure point when drafting the flights spec cell (e.g. 'LHR → CAI'). Frame day-1 schedule around arrival from this airport.",
    );
  }
  if (ctx.vibes && ctx.vibes.length > 0) {
    lines.push(`vibes: ${ctx.vibes.join(", ")}`);
    lines.push(
      "Skew activities + schedule toward these vibes. If 'chill' is present, keep pace relaxed. If 'nightlife', include at least one proper night out. If 'foodie', specific named restaurants. If 'outdoors' or 'active', include outdoor / physical activities.",
    );
  }
  if (ctx.topVotedShortlist && ctx.topVotedShortlist.length > 0) {
    lines.push(
      `crew_voted_activities: ${ctx.topVotedShortlist.slice(0, 10).join(", ")}`,
    );
  }
  lines.push("", "Draft the trip.");
  return lines.join("\n");
}

function extractJson(text: string): unknown {
  // The model sometimes wraps JSON in ```json fences or adds a
  // trailing period. Be lenient.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const objMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error("AI response did not contain a JSON object");
  return JSON.parse(objMatch[0]);
}

export async function draftTrip(ctx: DraftContext): Promise<DraftResult> {
  const { value, usage } = await runGeminiLoop({
    systemInstruction: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(ctx),
    schema: TripDraftSchema,
    biasLatitude: ctx.destinationLatitude ?? 0,
    biasLongitude: ctx.destinationLongitude ?? 0,
  });
  return { draft: value, usage };
}

export type SurfaceDraftInput = {
  surface: DraftSurface;
  ctx: DraftContext;
  existing: {
    hero_title?: string | null;
    hero_subtitle?: string | null;
    spec_grid?: SpecCell[];
    schedule?: ScheduleRow[];
    activities?: Array<{ title: string; meta?: string | null; category: "day" | "night" }>;
    bookings?: Array<{ title: string }>;
  };
  feedbackNote?: string | null;
};

export type SurfaceDraftResult =
  | { surface: "spec_grid"; value: SpecCell[]; usage: DraftUsage }
  | { surface: "schedule"; value: ScheduleRow[]; usage: DraftUsage }
  | { surface: "activities"; value: ActivityBrief[]; usage: DraftUsage }
  | { surface: "bookings"; value: BookingBrief[]; usage: DraftUsage };

export async function draftSurface(
  input: SurfaceDraftInput,
): Promise<SurfaceDraftResult> {
  const { surface, ctx } = input;
  const systemInstruction = buildSurfaceSystemPrompt(surface);
  const userPrompt = buildSurfaceUserPrompt(input);
  const biasLatitude = ctx.destinationLatitude ?? 0;
  const biasLongitude = ctx.destinationLongitude ?? 0;

  if (surface === "spec_grid") {
    const { value, usage } = await runGeminiLoop({
      systemInstruction,
      userPrompt,
      schema: SpecGridOnlySchema,
      biasLatitude,
      biasLongitude,
    });
    return { surface, value: value.spec_grid, usage };
  }
  if (surface === "schedule") {
    const { value, usage } = await runGeminiLoop({
      systemInstruction,
      userPrompt,
      schema: ScheduleOnlySchema,
      biasLatitude,
      biasLongitude,
    });
    return { surface, value: value.schedule, usage };
  }
  if (surface === "activities") {
    const { value, usage } = await runGeminiLoop({
      systemInstruction,
      userPrompt,
      schema: ActivitiesOnlySchema,
      biasLatitude,
      biasLongitude,
    });
    return { surface, value: value.activities, usage };
  }
  const { value, usage } = await runGeminiLoop({
    systemInstruction,
    userPrompt,
    schema: BookingsOnlySchema,
    biasLatitude,
    biasLongitude,
  });
  return { surface: "bookings", value: value.bookings, usage };
}

async function runGeminiLoop<T>({
  systemInstruction,
  userPrompt,
  schema,
  biasLatitude,
  biasLongitude,
}: {
  systemInstruction: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  biasLatitude: number;
  biasLongitude: number;
}): Promise<{ value: T; usage: DraftUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenAI({ apiKey });

  // Use SDK `Content` directly so we can echo the model's full response
  // parts back on the next turn — including `thoughtSignature` on
  // functionCall parts, which Gemini 3 requires for multi-turn tool
  // use when thinking is enabled. Reconstructing the turn ourselves
  // drops the signature → INVALID_ARGUMENT from the API.
  const contents: Content[] = [
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  let placesRequests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let thinkingTokens = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [SEARCH_PLACES_TOOL] }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.7,
      },
    });

    const usage = response.usageMetadata;
    inputTokens += usage?.promptTokenCount ?? 0;
    outputTokens += usage?.candidatesTokenCount ?? 0;
    thinkingTokens += usage?.thoughtsTokenCount ?? 0;

    const calls = response.functionCalls;
    const modelContent = response.candidates?.[0]?.content;
    if (calls && calls.length > 0 && modelContent) {
      const call = calls[0];
      if (call.name === "searchPlaces") {
        const args = (call.args as { query?: string } | undefined) ?? {};
        const query = args.query ?? "";
        let results: unknown[] = [];
        if (query && placesRequests < MAX_PLACES_REQUESTS) {
          placesRequests++;
          const hits = await searchText(query, {
            latitude: biasLatitude,
            longitude: biasLongitude,
            radiusMeters: 25_000,
            maxResults: 6,
          });
          results = hits;
        }
        contents.push(modelContent);
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "searchPlaces",
                response: { results },
              },
            },
          ],
        });
        continue;
      }
    }

    const text = response.text ?? "";
    const parsedUnknown = extractJson(text);
    const value = schema.parse(parsedUnknown);

    const aiCostUsd =
      inputTokens * GEMINI_INPUT_USD_PER_TOKEN +
      (outputTokens + thinkingTokens) * GEMINI_OUTPUT_USD_PER_TOKEN;
    const placesCostUsd = placesRequests * PLACES_SEARCH_USD_PER_REQUEST;

    return {
      value,
      usage: {
        provider: "gemini",
        model: MODEL,
        inputTokens,
        outputTokens,
        thinkingTokens,
        aiCostUsd: round4(aiCostUsd),
        placesRequests,
        placesCostUsd: round4(placesCostUsd),
        totalCostUsd: round4(aiCostUsd + placesCostUsd),
      },
    };
  }

  throw new Error(
    `AI draft exceeded ${MAX_TOOL_ITERATIONS} tool iterations without converging on a final response`,
  );
}

function buildSurfaceSystemPrompt(surface: DraftSurface): string {
  const shared = [
    "You are the trip-planning assistant for Tripcrew, a collaborative",
    "group-trip app. The crew has already drafted this trip once — you",
    "are re-drafting a single section. Stay consistent with the other",
    "sections already in place. Use the searchPlaces tool for any",
    "specific venue you name.",
    "",
    "Voice: tight, editorial, confident. Short sentences. Monocle, not",
    "AirTravel Weekly.",
    "",
  ].join("\n");

  const surfaceRules: Record<DraftSurface, string> = {
    spec_grid: [
      "Output ONLY the spec_grid: exactly 4 cells. Suggested labels:",
      '"Base" (where they sleep), "Flights" (route + duration), "Per head"',
      '(budget value), "The rule" (a single destination-specific constraint).',
      "",
      "Respond with a SINGLE JSON object, no prose:",
      '{ "spec_grid": [ { "label": string, "value": string, "sub": string }, ... × 4 ] }',
    ].join("\n"),
    schedule: [
      "Output ONLY the schedule. One row per trip day (inferred from",
      "start + end date), heading + 1–3 sentence body. Name specific",
      "venues; order by time of day.",
      "",
      "Respond with a SINGLE JSON object, no prose:",
      '{ "schedule": [ { "day_label": string, "heading": string, "body": string }, ... ] }',
    ].join("\n"),
    activities: [
      "Output ONLY the activities. 6–20 items, mix day + night,",
      'grounded in real venues. `meta` is an all-caps mono label like "2H · €35".',
      "",
      "Respond with a SINGLE JSON object, no prose:",
      '{ "activities": [ { "title": string, "meta": string, "category": "day"|"night" }, ... ] }',
    ].join("\n"),
    bookings: [
      "Output ONLY the bookings. 3–12 actionable items the crew must",
      'book or reserve in advance (e.g. "Book Michelin dinner at Belcanto Fri night").',
      "",
      "Respond with a SINGLE JSON object, no prose:",
      '{ "bookings": [ { "title": string }, ... ] }',
    ].join("\n"),
  };

  return shared + surfaceRules[surface];
}

function buildSurfaceUserPrompt(input: SurfaceDraftInput): string {
  const { surface, ctx, existing, feedbackNote } = input;
  const lines = [
    `destination: ${ctx.destination}`,
    `start_date: ${ctx.startDate ?? "TBD"}`,
    `end_date: ${ctx.endDate ?? "TBD"}`,
    `crew_size: ${ctx.crewSize}`,
    `budget_per_head: ${
      ctx.budgetPerHead !== null ? `${ctx.budgetPerHead} ${ctx.currency}` : "unset"
    }`,
  ];
  if (ctx.origin?.name) {
    lines.push(`origin_airport: ${ctx.origin.name}`);
  }
  if (ctx.vibes && ctx.vibes.length > 0) {
    lines.push(`vibes: ${ctx.vibes.join(", ")}`);
  }

  if (existing.hero_title) {
    lines.push("", `hero_title: ${existing.hero_title}`);
  }
  if (existing.hero_subtitle) {
    lines.push(`hero_subtitle: ${existing.hero_subtitle}`);
  }

  const includeSpec = surface !== "spec_grid" && existing.spec_grid?.length;
  const includeSchedule = surface !== "schedule" && existing.schedule?.length;
  const includeActivities =
    surface !== "activities" && existing.activities?.length;
  const includeBookings = surface !== "bookings" && existing.bookings?.length;

  if (includeSpec) {
    lines.push("", "existing spec_grid:");
    for (const c of existing.spec_grid!) {
      lines.push(`- ${c.label}: ${c.value}${c.sub ? ` (${c.sub})` : ""}`);
    }
  }
  if (includeSchedule) {
    lines.push("", "existing schedule:");
    for (const row of existing.schedule!) {
      lines.push(`- ${row.day_label}: ${row.heading}`);
    }
  }
  if (includeActivities) {
    lines.push("", "existing activities (sample):");
    for (const a of existing.activities!.slice(0, 8)) {
      lines.push(`- ${a.title}${a.meta ? ` — ${a.meta}` : ""}`);
    }
  }
  if (includeBookings) {
    lines.push("", "existing bookings:");
    for (const b of existing.bookings!.slice(0, 8)) {
      lines.push(`- ${b.title}`);
    }
  }

  if (feedbackNote && feedbackNote.trim()) {
    lines.push("", `the crew said: "${feedbackNote.trim()}"`);
    lines.push("Address this feedback in the new draft.");
  }

  lines.push("", `Re-draft the ${surface}.`);
  return lines.join("\n");
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
