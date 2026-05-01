"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canDraftCandidates } from "@/lib/gates";
import { createClient } from "@/lib/supabase/server";
import { buildBasicDraftPrompt, type TripContext } from "@/lib/ai/prompts";
import {
  estimateGeminiCostGBP,
  generateJson,
  getGeminiModelName,
} from "@/lib/ai/gemini";
import { BasicDraftSchema } from "@/lib/ai/schema";
import { logAiUsage } from "@/lib/ai/usage";
import type {
  AiOccasion,
  AiPreferences,
  AiVibeTag,
  TripMeta,
} from "@/lib/types";

export type DraftAllCandidatesResult =
  | { success: true; drafted: number; skipped: number; failed: number }
  | { success: false; error: string; upgradeCta: boolean };

const inputSchema = z.object({
  userId: z.string().uuid(),
  tripId: z.string().uuid(),
});

type TripRow = {
  id: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  target_crew_size: number | null;
  meta: TripMeta | null;
};

type CandidateRow = {
  id: string;
  title: string;
};

const CONCURRENCY = 3;

async function draftOne(
  userId: string,
  tripId: string,
  candidate: CandidateRow,
  baseCtx: Omit<TripContext, "destination">,
): Promise<"drafted" | "failed"> {
  const supabase = await createClient();
  const ctx: TripContext = { ...baseCtx, destination: candidate.title };
  const prompt = buildBasicDraftPrompt(ctx);

  try {
    const result = await generateJson(prompt, (raw) =>
      BasicDraftSchema.parse(raw),
    );

    const { error: updateError } = await supabase
      .from("destination_candidates")
      .update({
        basic_draft: result.data,
        basic_draft_generated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id);

    if (updateError) throw updateError;

    await logAiUsage({
      userId,
      tripId,
      feature: "candidate_draft_basic",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostGBP: estimateGeminiCostGBP(
        result.inputTokens,
        result.outputTokens,
      ),
      succeeded: true,
      durationMs: result.durationMs,
    });

    return "drafted";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAiUsage({
      userId,
      tripId,
      feature: "candidate_draft_basic",
      model: getGeminiModelName(),
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: message,
    });
    console.error(`draftAllCandidates: candidate ${candidate.id} failed:`, err);
    return "failed";
  }
}

export async function draftAllCandidates(
  rawInput: z.input<typeof inputSchema>,
): Promise<DraftAllCandidatesResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", upgradeCta: false };
  }

  const { userId, tripId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return { success: false, error: "Not signed in.", upgradeCta: false };
  }

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle<{ role: "admin" | "member" }>();

  if (!member) {
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }
  if (member.role !== "admin") {
    return {
      success: false,
      error: "Only trip admins can draft candidate plans.",
      upgradeCta: false,
    };
  }

  const gate = await canDraftCandidates(userId, tripId);
  if (!gate.allowed) {
    return { success: false, error: gate.reason, upgradeCta: gate.upgrade_cta };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, start_date, end_date, target_crew_size, meta")
    .eq("id", tripId)
    .maybeSingle<TripRow>();

  if (!trip) {
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }

  if (!trip.start_date || !trip.end_date) {
    return {
      success: false,
      error: "Set trip dates before drafting candidate plans.",
      upgradeCta: false,
    };
  }

  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data: candidates, error: candidatesError } = await supabase
    .from("destination_candidates")
    .select("id, title")
    .eq("trip_id", tripId)
    .is("basic_draft", null)
    .order("position", { ascending: true })
    .returns<CandidateRow[]>();

  if (candidatesError) {
    return {
      success: false,
      error: "Could not load candidates.",
      upgradeCta: false,
    };
  }

  const { count: totalCandidates } = await supabase
    .from("destination_candidates")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const pending = candidates ?? [];
  const total = totalCandidates ?? 0;
  const skipped = total - pending.length;

  if (pending.length === 0) {
    return { success: true, drafted: 0, skipped, failed: 0 };
  }

  const prefs: AiPreferences | undefined = trip.meta?.ai_preferences;
  const baseCtx: Omit<TripContext, "destination"> = {
    tripId: trip.id,
    startDate: trip.start_date,
    endDate: trip.end_date,
    // Mirrors generateLockAndDraft: prefer the admin's stated intent
    // (target_crew_size) over the live trip_members count, so per-
    // candidate basic drafts plan for the group size the admin
    // specified in the dialog rather than the people who've joined so
    // far (typically just the admin).
    crewSize: trip.target_crew_size ?? crewCount ?? 1,
    origin: prefs?.origin?.name ?? undefined,
    notes: prefs?.notes,
    vibes: prefs?.vibes as AiVibeTag[] | undefined,
    occasion: prefs?.occasion as AiOccasion | undefined,
    budgetTier: prefs?.budget_tier,
  };

  let drafted = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((c) => draftOne(userId, tripId, c, baseCtx)),
    );
    for (const r of results) {
      if (r === "drafted") drafted++;
      else failed++;
    }
  }

  revalidatePath(`/trips/${trip.slug}/destinations`);

  return { success: true, drafted, skipped, failed };
}
