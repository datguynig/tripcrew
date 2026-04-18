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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenAI({ apiKey });

  // Use SDK `Content` directly so we can echo the model's full response
  // parts back on the next turn — including `thoughtSignature` on
  // functionCall parts, which Gemini 3 requires for multi-turn tool
  // use when thinking is enabled. Reconstructing the turn ourselves
  // drops the signature → INVALID_ARGUMENT from the API.
  const contents: Content[] = [
    { role: "user", parts: [{ text: buildUserPrompt(ctx) }] },
  ];

  let placesRequests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let thinkingTokens = 0;

  // Location bias for Places calls. If we don't have coords (pre-Mapbox
  // trips), bias is degraded but searchText still works — tweak later.
  const biasLat = ctx.destinationLatitude ?? 0;
  const biasLng = ctx.destinationLongitude ?? 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
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
            latitude: biasLat,
            longitude: biasLng,
            radiusMeters: 25_000,
            maxResults: 6,
          });
          results = hits;
        }
        // Echo the model's full content back — preserves thoughts +
        // thoughtSignature on the functionCall part.
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
    const draft = TripDraftSchema.parse(parsedUnknown);

    const aiCostUsd =
      inputTokens * GEMINI_INPUT_USD_PER_TOKEN +
      (outputTokens + thinkingTokens) * GEMINI_OUTPUT_USD_PER_TOKEN;
    const placesCostUsd = placesRequests * PLACES_SEARCH_USD_PER_REQUEST;

    return {
      draft,
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

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
