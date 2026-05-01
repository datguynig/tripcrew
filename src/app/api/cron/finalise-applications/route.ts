import { NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildApplicationApprovedEmail,
  buildApplicationSoftRejectedEmail,
  sendApplicationApproved,
  sendApplicationSoftRejected,
} from "@/lib/email/teaserEmails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH_LIMIT = 100;

type PendingApplication = {
  id: string;
  email: string;
  provisional_decision: "approve" | "reject" | null;
};

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron/finalise-applications] CRON_SECRET is not configured.",
    );
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: pending, error: queryErr } = await supabase
    .from("applications")
    .select("id, email, provisional_decision")
    .lt("auto_decision_at", nowIso)
    .is("decision_finalised_at", null)
    .limit(BATCH_LIMIT)
    .returns<PendingApplication[]>();

  if (queryErr) {
    console.error(
      "[cron/finalise-applications] pending query failed",
      queryErr,
    );
    return NextResponse.json(
      { error: "Could not load pending applications." },
      { status: 500 },
    );
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let approved = 0;
  let rejected = 0;
  let failed = 0;

  for (const app of pending) {
    // Defensive: any row with auto_decision_at set must also have a
    // provisional_decision (the heuristic stamps both on insert). Skip
    // any drift case rather than guessing.
    if (
      app.provisional_decision !== "approve" &&
      app.provisional_decision !== "reject"
    ) {
      console.error(
        "[cron/finalise-applications] missing provisional_decision",
        app.id,
      );
      failed += 1;
      continue;
    }

    if (app.provisional_decision === "approve") {
      const { error: updateErr } = await supabase
        .from("applications")
        .update({
          approved_at: nowIso,
          decision_finalised_at: nowIso,
          decision_finalised_by: "cron",
        })
        .eq("id", app.id)
        .is("decision_finalised_at", null);

      if (updateErr) {
        console.error(
          "[cron/finalise-applications] approve update failed",
          app.id,
          updateErr,
        );
        failed += 1;
        continue;
      }
      approved += 1;

      const recipient = app.email;
      const applicationId = app.id;
      after(async () => {
        try {
          await sendApplicationApproved(
            buildApplicationApprovedEmail({
              email: recipient,
              applicationId,
              annualEnabled: !!process.env.STRIPE_PRICE_ID_ANNUAL,
            }),
          );
        } catch (err) {
          console.error(
            "[cron/finalise-applications] approved-email send failed",
            err,
          );
        }
      });
    } else {
      const { error: updateErr } = await supabase
        .from("applications")
        .update({
          rejected_at: nowIso,
          decision_finalised_at: nowIso,
          decision_finalised_by: "cron",
        })
        .eq("id", app.id)
        .is("decision_finalised_at", null);

      if (updateErr) {
        console.error(
          "[cron/finalise-applications] reject update failed",
          app.id,
          updateErr,
        );
        failed += 1;
        continue;
      }
      rejected += 1;

      const recipient = app.email;
      after(async () => {
        try {
          await sendApplicationSoftRejected(
            buildApplicationSoftRejectedEmail({ email: recipient }),
          );
        } catch (err) {
          console.error(
            "[cron/finalise-applications] rejected-email send failed",
            err,
          );
        }
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: pending.length,
    approved,
    rejected,
    failed,
  });
}
