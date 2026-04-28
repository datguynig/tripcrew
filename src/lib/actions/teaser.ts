"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { checkBotId } from "botid/server";
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
import {
  buildTeaserConfirmationEmail,
  sendTeaserConfirmation,
} from "@/lib/email/teaserEmails";
import { buildCacheKey, hashIp } from "@/lib/teaser/hash";
import {
  DRAFT_COOKIE_NAME,
  draftCookieOptions,
} from "@/lib/teaser/cookieConfig";
import type { TeaserInputs, TeaserOutput } from "@/lib/types";

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

/**
 * Resolve the request's client IP from the standard Vercel/proxy headers.
 * `x-forwarded-for` may contain a comma-separated chain (`client, proxy1,
 * proxy2`); we take the first entry as the originating client. Falls back
 * to `x-real-ip` then `127.0.0.1` so server-side tests and local dev
 * always have a stable value.
 */
async function resolveClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Manual kill switch. Set TEASER_ENABLED=false in Vercel env to instantly
 * stop new teaser generations (existing drafts and the resume flow keep
 * working). Use when the cost-ceiling alert fires or any other reason
 * to pause AI burn without a deploy.
 */
function teaserKillSwitchActive(): boolean {
  return process.env.TEASER_ENABLED === "false";
}

export async function submitTeaserForm(
  rawInput: unknown,
): Promise<SubmitTeaserResult> {
  if (teaserKillSwitchActive()) {
    return {
      ok: false,
      error:
        "We've paused new drafts for now. Apply for an invite and we'll get to you.",
      rateLimited: true,
    };
  }

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

  // Vercel BotID — invisible challenge against scraper abuse. Returns
  // `isBot: false` in local dev and on platforms outside Vercel
  // (see https://vercel.com/docs/botid/local-development-behavior),
  // so the production gate adds protection without breaking dev. Errors
  // from the SDK fall through as a soft pass — better to let humans
  // through than to nuke conversion if BotID is misconfigured.
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return {
        ok: false,
        error: "Bot detection failed. Please try again.",
      };
    }
  } catch (err) {
    console.error("submitTeaserForm: BotID check failed:", err);
  }

  const ip = await resolveClientIp();
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
  cookieStore.set(DRAFT_COOKIE_NAME, inserted.id, draftCookieOptions());

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

  // Use after() so the email is dispatched once the response is on the
  // wire. Plain fire-and-forget (`void ...catch`) can be cut off when
  // Vercel freezes the serverless function at response time.
  after(async () => {
    try {
      await sendTeaserConfirmation(
        buildTeaserConfirmationEmail({
          email,
          draftId: inserted.id,
          resumeToken: inserted.resume_token,
          slug,
          inputs,
          teaser,
        }),
      );
    } catch (err) {
      console.error("submitTeaserForm: confirmation email failed:", err);
    }
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
