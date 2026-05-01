"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  runConciergeAgent,
  type ConciergeTripState,
  type ConciergeTurn,
} from "@/lib/ai/concierge";
import { getGeminiModelName } from "@/lib/ai/gemini";
import { logAiUsage } from "@/lib/ai/usage";
import type { ConciergeMessage } from "@/lib/types";

type SendResult =
  | { ok: true; userMessage: ConciergeMessage; assistantMessage: ConciergeMessage }
  | { ok?: false; error: string };

const sendInput = z.object({
  tripId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function sendConciergeMessage(input: {
  tripId: string;
  body: string;
}): Promise<SendResult> {
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const service = createServiceClient();

  // Pioneer gate: must have founding_crew_at stamped on the profile.
  const { data: profile } = await service
    .from("profiles")
    .select("founding_crew_at")
    .eq("id", user.id)
    .maybeSingle<{ founding_crew_at: string | null }>();

  if (!profile?.founding_crew_at) {
    return { error: "Concierge is a Pioneer benefit." };
  }

  // Membership gate: caller must be on the trip.
  const { data: membership } = await service
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "You're not on this trip." };

  // Gather trip state.
  const state = await loadTripState(parsed.data.tripId, service);
  if (!state) return { error: "Trip not found." };

  // Pull the last 8 turns of history for this user/trip.
  const { data: history } = await service
    .from("concierge_messages")
    .select("role, content")
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(16)
    .returns<{ role: "user" | "assistant"; content: string }[]>();

  const turns: ConciergeTurn[] = (history ?? []).map((row) => ({
    role: row.role,
    content: row.content,
  }));

  // Persist the user message before calling the agent so it's visible
  // even if the model fails.
  const { data: userRow, error: userErr } = await service
    .from("concierge_messages")
    .insert({
      trip_id: parsed.data.tripId,
      user_id: user.id,
      role: "user",
      content: parsed.data.body,
    })
    .select("*")
    .single<ConciergeMessage>();

  if (userErr || !userRow) {
    console.error("sendConciergeMessage: user insert failed", userErr);
    return { error: "Could not send. Try again." };
  }

  let agentResult;
  try {
    agentResult = await runConciergeAgent({
      state,
      history: turns,
      userMessage: parsed.data.body,
    });
  } catch (err) {
    console.error("sendConciergeMessage: agent failed", err);
    return { error: "Concierge couldn't reply. Try again." };
  }

  const { data: assistantRow, error: asstErr } = await service
    .from("concierge_messages")
    .insert({
      trip_id: parsed.data.tripId,
      user_id: user.id,
      role: "assistant",
      content: agentResult.text,
      proposals: agentResult.proposals.length > 0 ? agentResult.proposals : null,
      token_in: agentResult.inputTokens,
      token_out: agentResult.outputTokens,
    })
    .select("*")
    .single<ConciergeMessage>();

  if (asstErr || !assistantRow) {
    console.error("sendConciergeMessage: assistant insert failed", asstErr);
    return { error: "Reply received but couldn't be saved. Refresh." };
  }

  // Cost telemetry.
  await logAiUsage({
    userId: user.id,
    tripId: parsed.data.tripId,
    feature: "concierge_chat",
    model: getGeminiModelName(),
    inputTokens: agentResult.inputTokens,
    outputTokens: agentResult.outputTokens,
    placesCalls: agentResult.toolCalls,
    estimatedCostGBP: agentResult.costGBP,
    succeeded: true,
    durationMs: agentResult.durationMs,
  });

  revalidatePath(`/trips/[slug]/concierge`, "page");

  return { ok: true, userMessage: userRow, assistantMessage: assistantRow };
}

type ScheduleSlot = { time: string; title: string; note?: string };
type ScheduleEntry = { day: number; slots: ScheduleSlot[] };

async function loadTripState(
  tripId: string,
  service: ReturnType<typeof createServiceClient>,
): Promise<ConciergeTripState | null> {
  const { data: trip } = await service
    .from("trips")
    .select(
      "id, hero_title, hero_subtitle, city_label, dates_label, target_budget_pp, target_crew_size, currency, start_date, end_date, meta",
    )
    .eq("id", tripId)
    .maybeSingle<{
      id: string;
      hero_title: string | null;
      hero_subtitle: string | null;
      city_label: string | null;
      dates_label: string | null;
      target_budget_pp: number | null;
      target_crew_size: number | null;
      currency: string | null;
      start_date: string | null;
      end_date: string | null;
      meta: { schedule?: unknown } | null;
    }>();

  if (!trip) return null;

  const { data: activities } = await service
    .from("activities")
    .select("id, title, description")
    .eq("trip_id", tripId)
    .limit(40)
    .returns<{ id: string; title: string; description: string | null }[]>();

  const { data: expenses } = await service
    .from("expenses")
    .select("amount")
    .eq("trip_id", tripId)
    .returns<{ amount: number }[]>();

  const totalSpent = (expenses ?? []).reduce(
    (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
    0,
  );
  const crewSize = trip.target_crew_size ?? 1;
  const perPerson = crewSize > 0 ? totalSpent / crewSize : totalSpent;

  return {
    destination: trip.city_label ?? trip.hero_title ?? "your destination",
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
    crewSize,
    currency: trip.currency ?? "£",
    targetBudgetPp: trip.target_budget_pp,
    brief: {
      heroTitle: trip.hero_title,
      heroSubtitle: trip.hero_subtitle,
      cityLabel: trip.city_label,
      datesLabel: trip.dates_label,
    },
    schedule: parseSchedule(trip.meta?.schedule),
    activities: activities ?? [],
    ledgerSummary: { totalSpent, perPerson },
  };
}

function parseSchedule(raw: unknown): ScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ScheduleEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const day = typeof r.day === "number" ? r.day : i + 1;
    const slotsRaw = Array.isArray(r.slots) ? r.slots : [];
    const slots: ScheduleSlot[] = [];
    for (const s of slotsRaw) {
      if (typeof s !== "object" || s === null) continue;
      const slot = s as Record<string, unknown>;
      if (typeof slot.time !== "string" || typeof slot.title !== "string") continue;
      const parsedSlot: ScheduleSlot = {
        time: slot.time,
        title: slot.title,
      };
      if (typeof slot.note === "string") parsedSlot.note = slot.note;
      slots.push(parsedSlot);
    }
    entries.push({ day, slots });
  }
  return entries;
}
