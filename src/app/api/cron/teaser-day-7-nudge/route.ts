/**
 * Day-7 nudge cron.
 *
 * Sends a founding-scarcity nudge to draft_leads created > 7 days ago that
 * never converted to an application and never unsubscribed. One-shot per
 * lead — guarded by `nudge_sent_at`.
 *
 * Manual verification (after migrations are applied):
 *   1. Backdate a draft_lead:
 *        UPDATE draft_leads SET created_at = now() - interval '8 days'
 *        WHERE id = '<id>';
 *   2. Hit the cron:
 *        curl -H "Authorization: Bearer $CRON_SECRET" \
 *          /api/cron/teaser-day-7-nudge
 *   3. Expect { sent: 1 }.
 *   4. Verify the email arrives at the lead's inbox.
 *   5. Re-run the cron — expect { sent: 0 } (nudge_sent_at is now set).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildDay7NudgeEmail,
  sendDay7Nudge,
} from "@/lib/email/teaserEmails";
import { foundingSeatsRemaining } from "@/lib/actions/foundingReservation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH_LIMIT = 200;

type NudgeCandidate = {
  id: string;
  email: string;
  slug: string;
  resume_token: string;
};

type AppliedRow = { draft_lead_id: string | null };

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron/teaser-day-7-nudge] CRON_SECRET is not configured.",
    );
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: candidates, error: queryErr } = await supabase
    .from("draft_leads")
    .select("id, email, slug, resume_token")
    .lt("created_at", sevenDaysAgoIso)
    .is("nudge_sent_at", null)
    .is("unsubscribed_at", null)
    .limit(BATCH_LIMIT)
    .returns<NudgeCandidate[]>();

  if (queryErr) {
    console.error(
      "[cron/teaser-day-7-nudge] candidate query failed",
      queryErr,
    );
    return NextResponse.json(
      { error: "Could not load nudge candidates." },
      { status: 500 },
    );
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0 });
  }

  const candidateIds = candidates.map((c) => c.id);
  const { data: applied, error: appliedErr } = await supabase
    .from("applications")
    .select("draft_lead_id")
    .in("draft_lead_id", candidateIds)
    .returns<AppliedRow[]>();

  if (appliedErr) {
    console.error(
      "[cron/teaser-day-7-nudge] applications lookup failed",
      appliedErr,
    );
    return NextResponse.json(
      { error: "Could not load applications." },
      { status: 500 },
    );
  }

  const appliedSet = new Set(
    (applied ?? [])
      .map((row) => row.draft_lead_id)
      .filter((id): id is string => Boolean(id)),
  );

  const eligible = candidates.filter((c) => !appliedSet.has(c.id));
  const skipped = candidates.length - eligible.length;

  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, skipped, errors: 0 });
  }

  const foundingRemaining = await foundingSeatsRemaining();

  let sent = 0;
  let errors = 0;
  const nowIso = new Date().toISOString();

  for (const lead of eligible) {
    try {
      await sendDay7Nudge(
        buildDay7NudgeEmail({
          email: lead.email,
          draftId: lead.id,
          resumeToken: lead.resume_token,
          slug: lead.slug,
          foundingRemaining,
        }),
      );
    } catch (err) {
      console.error(
        "[cron/teaser-day-7-nudge] nudge send failed",
        lead.id,
        err,
      );
      errors += 1;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("draft_leads")
      .update({ nudge_sent_at: nowIso })
      .eq("id", lead.id)
      .is("nudge_sent_at", null);

    if (updateErr) {
      console.error(
        "[cron/teaser-day-7-nudge] nudge_sent_at update failed",
        lead.id,
        updateErr,
      );
      errors += 1;
      continue;
    }
    sent += 1;
  }

  return NextResponse.json({ sent, skipped, errors });
}
