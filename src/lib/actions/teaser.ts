"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { estimateGeminiCostGBP, generateJson } from "@/lib/ai/gemini";
import { logTeaserAiUsage } from "@/lib/ai/usage";
import { buildTeaserPrompt } from "@/lib/ai/teaserPrompt";
import { parseTeaserOutput } from "@/lib/ai/teaserSchema";
import {
  normalizeTeaserInputs,
  teaserSubmissionSchema,
} from "@/lib/validators/teaser";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";
import { sendTeaserConfirmation } from "@/lib/email/teaserEmails";
import { buildCacheKey, hashIp } from "@/lib/teaser/hash";
import type { TeaserInputs, TeaserOutput } from "@/lib/types";

const COOKIE_NAME = "tc_draft_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const RATE_LIMIT = 2;

export type SubmitTeaserResult =
  | { ok: true; draftId: string; teaser: TeaserOutput }
  | { ok: false; error: string; rateLimited?: boolean };

type CachedRow = {
  id: string;
  resume_token: string;
  teaser: TeaserOutput | null;
};

type InsertedRow = {
  id: string;
  resume_token: string;
};

export async function submitTeaserForm(
  rawInput: unknown,
  ip: string,
): Promise<SubmitTeaserResult> {
  const parsed = teaserSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input" };
  }

  const { email, slug, ...inputsRaw } = parsed.data;
  const inputs: TeaserInputs = inputsRaw;

  const trip = getCuratedTripBySlug(slug);
  if (!trip) {
    return { ok: false, error: "Unknown trip" };
  }

  let ipHash: string;
  try {
    ipHash = hashIp(ip);
  } catch (err) {
    console.error("submitTeaserForm: hashIp failed:", err);
    return { ok: false, error: "Server misconfigured" };
  }

  const supabase = createServiceClient();

  // Lifetime cap of 2 per IP. The count→insert window is intentionally not
  // transactional: worst case a parallel submitter wins a third row, which
  // is cheaper than serialising every form submit on a global lock.
  const { count, error: countError } = await supabase
    .from("draft_leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash);

  if (countError) {
    console.error("submitTeaserForm: rate-limit count failed:", countError);
    return { ok: false, error: "Something went wrong. Try again in a moment." };
  }

  if ((count ?? 0) >= RATE_LIMIT) {
    return {
      ok: false,
      error:
        "You've already started two drafts. To start more, apply for an invite.",
      rateLimited: true,
    };
  }

  const cacheKey = buildCacheKey(slug, normalizeTeaserInputs(inputs));

  const { data: cached, error: cacheError } = await supabase
    .from("draft_leads")
    .select("id, resume_token, teaser")
    .eq("cache_key", cacheKey)
    .not("teaser", "is", null)
    .limit(1)
    .maybeSingle<CachedRow>();

  if (cacheError) {
    console.error("submitTeaserForm: cache lookup failed:", cacheError);
  }

  let teaser: TeaserOutput;
  let usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  } | null = null;

  if (cached?.teaser) {
    teaser = cached.teaser;
  } else {
    try {
      const result = await generateJson(
        buildTeaserPrompt(trip, inputs),
        parseTeaserOutput,
      );
      teaser = result.data;
      usage = {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: result.durationMs,
      };
    } catch (err) {
      console.error("submitTeaserForm: gemini generation failed:", err);
      return {
        ok: false,
        error: "Could not draft your teaser. Try again in a moment.",
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("draft_leads")
    .insert({
      email,
      ip_hash: ipHash,
      slug,
      inputs,
      teaser,
      cache_key: cacheKey,
    })
    .select("id, resume_token")
    .single<InsertedRow>();

  if (insertError || !inserted) {
    console.error("submitTeaserForm: insert failed:", insertError);
    return { ok: false, error: "Something went wrong. Try again in a moment." };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, inserted.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  if (usage) {
    await logTeaserAiUsage({
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostGBP: estimateGeminiCostGBP(
        usage.inputTokens,
        usage.outputTokens,
      ),
      durationMs: usage.durationMs,
    });
  }

  void sendTeaserConfirmation({
    email,
    draftId: inserted.id,
    resumeToken: inserted.resume_token,
    slug,
    inputs,
    teaser,
  }).catch((err) => {
    console.error("submitTeaserForm: confirmation email failed:", err);
  });

  return { ok: true, draftId: inserted.id, teaser };
}

export async function unsubscribeDraftLead(
  draftId: string,
  token: string,
): Promise<{ ok: boolean }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("draft_leads")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("resume_token", token);

  if (error) {
    console.error("unsubscribeDraftLead: update failed:", error);
  }
  return { ok: !error };
}
