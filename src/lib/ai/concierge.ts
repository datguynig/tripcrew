import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
} from "@google/genai";
import type { ConciergeProposal } from "@/lib/types";
import { textSearch } from "@/lib/places/text-search";
import {
  estimateGeminiCostGBP,
  getGeminiModelName,
} from "@/lib/ai/gemini";

export interface ConciergeTripState {
  destination: string;
  startDate: string;
  endDate: string;
  crewSize: number;
  currency: string;
  targetBudgetPp: number | null;
  brief: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    cityLabel: string | null;
    datesLabel: string | null;
  };
  schedule: { day: number; slots: { time: string; title: string; note?: string }[] }[];
  activities: { id: string; title: string; description: string | null }[];
  ledgerSummary: { totalSpent: number; perPlannedPerson: number };
}

export interface ConciergeTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeAgentResult {
  text: string;
  proposals: ConciergeProposal[];
  inputTokens: number;
  outputTokens: number;
  costGBP: number;
  toolCalls: number;
  durationMs: number;
}

const MAX_TOOL_TURNS = 8;

const SYSTEM_PROMPT = `You are the Yenkoh concierge — a thoughtful, opinionated travel-planning assistant for the Pioneer tier. You help refine an existing trip plan through natural conversation.

GROUND RULES
- The trip already has a destination, dates, schedule, activities, and budget. You're here to refine, not start from scratch.
- Be concrete. "Try a sunset boat tour" is weak. "I'd swap day 2's afternoon for a 90-min sunset sail from Cascais marina — most operators take £35pp" is strong.
- Never invent venues. If you suggest a specific place, search for it via search_places first.
- Never silently change the trip. To change anything, emit a proposal via the propose_* tools — the user gets a card with an Apply button. Apply is THEIR action, not yours.
- One concrete suggestion per turn beats five vague ones.
- If the user asks something you can't answer with the trip state + Places search (live flight prices, weather, real-time events), say so and give them a useful adjacent answer.

TONE
- Friendly but not chirpy. Short sentences. No emoji. No "Great question!"
- Talk to the Pioneer like a sharp friend who plans trips for a living.
- Use periods and commas. Never use em dashes — they read as AI slop. Middots (·) are fine in lists.

WHEN TO PROPOSE VS WHEN TO JUST TALK
- Talk: clarifying questions, vibes, options the user is weighing.
- Propose: when the user has expressed clear intent for a change ("swap day 2 to Sintra", "find me a quieter restaurant", "bump the budget to £200pp").`;

function buildTripStateBlock(state: ConciergeTripState): string {
  const lines: string[] = [];
  lines.push("CURRENT TRIP STATE");
  lines.push(`- Destination: ${state.destination}`);
  lines.push(`- Dates: ${state.startDate} → ${state.endDate}`);
  lines.push(`- Crew size: ${state.crewSize}`);
  lines.push(`- Currency: ${state.currency}`);
  if (state.targetBudgetPp !== null) {
    lines.push(`- Target budget per person: ${state.currency}${state.targetBudgetPp}`);
  }
  if (state.brief.heroTitle) lines.push(`- Hero title: ${state.brief.heroTitle}`);
  if (state.brief.heroSubtitle) lines.push(`- Hero subtitle: ${state.brief.heroSubtitle}`);

  if (state.schedule.length > 0) {
    lines.push("");
    lines.push("SCHEDULE");
    for (const day of state.schedule) {
      lines.push(`Day ${day.day}:`);
      for (const slot of day.slots) {
        lines.push(`  ${slot.time} — ${slot.title}${slot.note ? ` (${slot.note})` : ""}`);
      }
    }
  }

  if (state.activities.length > 0) {
    lines.push("");
    lines.push("ACTIVITIES (shortlisted)");
    for (const a of state.activities.slice(0, 20)) {
      lines.push(`- ${a.title}${a.description ? `: ${a.description}` : ""}`);
    }
  }

  lines.push("");
  lines.push("LEDGER");
  lines.push(
    `- Spent so far: ${state.currency}${state.ledgerSummary.totalSpent.toFixed(0)} total · ${state.currency}${state.ledgerSummary.perPlannedPerson.toFixed(0)} pp vs planned crew of ${state.crewSize}`,
  );

  return lines.join("\n");
}

const TOOL_DEFINITIONS: FunctionDeclaration[] = [
  {
    name: "search_places",
    description:
      "Search Google Places for restaurants, activities, hotels, museums, etc. near a city or address. Use whenever the user asks about specific spots and you don't already have them in the trip state.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "What to search for, e.g. 'sushi restaurants', 'rooftop bars', 'family-friendly hikes'",
        },
        near: {
          type: Type.STRING,
          description: "City or area to search near, e.g. 'Lisbon, Portugal'",
        },
        max_results: {
          type: Type.NUMBER,
          description: "Up to 10 results. Default 5.",
        },
      },
      required: ["query", "near"],
    },
  },
  {
    name: "propose_activity_add",
    description:
      "Propose adding a new activity to the shortlist. The user sees an Apply button on the card; you do not write to the trip yourself.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Activity title, e.g. 'Sunset sail from Cascais'" },
        description: { type: Type.STRING, description: "1-2 sentences. What it is, why this crew might like it." },
        location: { type: Type.STRING, description: "Address or area" },
        day: { type: Type.NUMBER, description: "Trip day (1-indexed) you'd slot it into. Optional." },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "propose_schedule_revise",
    description:
      "Propose replacing a single day's schedule slots. The user sees an Apply button; you do not write to the trip yourself. Use when the user has expressed clear intent to swap a day's plan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.NUMBER, description: "Trip day (1-indexed) to replace" },
        slots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING, description: "Slot time, e.g. '09:00', 'Morning', 'Afternoon'" },
              title: { type: Type.STRING, description: "Headline activity for the slot" },
              note: { type: Type.STRING, description: "Optional one-liner of detail" },
            },
            required: ["time", "title"],
          },
        },
      },
      required: ["day", "slots"],
    },
  },
  {
    name: "propose_budget_change",
    description:
      "Propose changing the trip's target per-person budget. The user sees an Apply button; you do not write to the trip yourself.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_target_pp: { type: Type.NUMBER, description: "New target per-person amount in the trip's currency" },
        reason: { type: Type.STRING, description: "Why the change makes sense — 1 short sentence" },
      },
      required: ["new_target_pp", "reason"],
    },
  },
];

type FunctionCallPart = { name?: string; args?: Record<string, unknown> };

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
}

async function executeTool(
  call: FunctionCallPart,
  state: ConciergeTripState,
  proposals: ConciergeProposal[],
): Promise<unknown> {
  const args = (call.args ?? {}) as Record<string, unknown>;

  switch (call.name) {
    case "search_places": {
      const query = String(args.query ?? "");
      const near = String(args.near ?? "");
      const maxResults = Number(args.max_results ?? 5);
      if (!query || !near) return { error: "query and near are required" };
      const results = await textSearch({
        query: `${query} near ${near}`,
        maxResults: Math.min(10, Math.max(1, maxResults)),
      });
      return {
        places: results.map((p) => ({
          name: p.name,
          address: p.formattedAddress ?? null,
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
          priceLevel: p.priceLevel ?? null,
          summary: p.editorialSummary ?? null,
        })),
      };
    }

    case "propose_activity_add": {
      proposals.push({
        kind: "activity_add",
        payload: {
          name: String(args.name ?? "").slice(0, 200),
          description: String(args.description ?? "").slice(0, 1000),
          location: args.location ? String(args.location).slice(0, 200) : undefined,
          day: typeof args.day === "number" ? args.day : undefined,
        },
      });
      return { ok: true };
    }

    case "propose_schedule_revise": {
      const day = typeof args.day === "number" ? args.day : 1;
      const rawSlots = Array.isArray(args.slots) ? args.slots : [];
      const slots = rawSlots
        .filter(
          (s): s is { time: string; title: string; note?: string } =>
            typeof s === "object" && s !== null && "time" in s && "title" in s,
        )
        .map((s) => ({
          time: String(s.time).slice(0, 50),
          title: String(s.title).slice(0, 200),
          note: s.note ? String(s.note).slice(0, 300) : undefined,
        }));
      proposals.push({ kind: "schedule_revise", payload: { day, slots } });
      return { ok: true };
    }

    case "propose_budget_change": {
      proposals.push({
        kind: "budget_change",
        payload: {
          new_target_pp: Number(args.new_target_pp ?? 0),
          currency: state.currency,
          reason: String(args.reason ?? "").slice(0, 500),
        },
      });
      return { ok: true };
    }

    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}

export async function runConciergeAgent({
  state,
  history,
  userMessage,
}: {
  state: ConciergeTripState;
  history: ConciergeTurn[];
  userMessage: string;
}): Promise<ConciergeAgentResult> {
  const start = Date.now();
  const model = getGeminiModelName();
  const client = getClient();

  const systemInstruction = `${SYSTEM_PROMPT}\n\n${buildTripStateBlock(state)}`;

  const contents: Content[] = [];
  for (const turn of history.slice(-8)) {
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const proposals: ConciergeProposal[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;
  let finalText = "";

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const result = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: [{ functionDeclarations: TOOL_DEFINITIONS }],
      },
    });

    const usage = result.usageMetadata;
    inputTokens += usage?.promptTokenCount ?? 0;
    outputTokens += usage?.candidatesTokenCount ?? 0;

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const functionCalls = parts
      .map((p) => p.functionCall)
      .filter((fc): fc is FunctionCallPart => Boolean(fc));

    if (functionCalls.length === 0) {
      finalText = parts
        .map((p) => p.text ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
      break;
    }

    // Pass the model's parts back verbatim — Gemini 3 includes a
    // thoughtSignature on functionCall parts that must round-trip
    // unchanged on the next turn or the API rejects with 400.
    contents.push({ role: "model", parts });

    const toolResponses = await Promise.all(
      functionCalls.map(async (call) => {
        toolCalls++;
        const response = await executeTool(call, state, proposals);
        return {
          functionResponse: {
            name: call.name ?? "unknown",
            response: response as Record<string, unknown>,
          },
        };
      }),
    );

    contents.push({ role: "user", parts: toolResponses });
  }

  // If the model never emitted a final text response (e.g. hit
  // MAX_TOOL_TURNS or kept asking for tools), do one last call without
  // tools to force a plain summary. Without this, the user sees a
  // canned fallback string and the proposals look orphaned.
  if (!finalText) {
    try {
      const summary = await client.models.generateContent({
        model,
        contents: [
          ...contents,
          {
            role: "user",
            parts: [
              {
                text: "Now respond to the original message in plain text. Don't call any more tools. Summarise what you found and what you've proposed.",
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      const summaryUsage = summary.usageMetadata;
      inputTokens += summaryUsage?.promptTokenCount ?? 0;
      outputTokens += summaryUsage?.candidatesTokenCount ?? 0;
      finalText = (summary.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
    } catch (err) {
      console.error("concierge summary fallback failed", err);
    }
  }

  if (!finalText) {
    finalText =
      proposals.length > 0
        ? "Here are some options. Tap Apply on a card to make a change."
        : "I'm not sure how to refine that. Could you tell me more about what you're after?";
  }

  return {
    text: finalText,
    proposals,
    inputTokens,
    outputTokens,
    costGBP: estimateGeminiCostGBP(inputTokens, outputTokens),
    toolCalls,
    durationMs: Date.now() - start,
  };
}
