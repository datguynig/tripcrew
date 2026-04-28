"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { DRAFT_COOKIE_NAME } from "@/lib/teaser/cookieConfig";
import type { DraftLead } from "@/lib/types";

export async function readDraftFromCookie(
  slug: string,
): Promise<DraftLead | null> {
  const cookieStore = await cookies();
  const draftId = cookieStore.get(DRAFT_COOKIE_NAME)?.value;
  if (!draftId) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftId)
    .eq("slug", slug)
    .maybeSingle<DraftLead>();

  if (error) {
    console.error("readDraftFromCookie: lookup failed:", error);
    return null;
  }
  return data ?? null;
}

/**
 * Look up a draft by id+resume_token+slug. Returns the draft when all three
 * line up, otherwise null. Cookie persistence on resume is intentionally
 * not handled here. Next.js 16 disallows cookie mutations inside Server
 * Component render, so the page only reads cookies. A follow-up Route
 * Handler can persist the cookie when we wire the email-nudge resume flow.
 */
export async function validateResumeToken(
  draftId: string,
  token: string,
  slug: string,
): Promise<DraftLead | null> {
  if (!draftId || !token || !slug) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftId)
    .eq("resume_token", token)
    .eq("slug", slug)
    .maybeSingle<DraftLead>();

  if (error) {
    console.error("validateResumeToken: lookup failed:", error);
    return null;
  }
  return data ?? null;
}
