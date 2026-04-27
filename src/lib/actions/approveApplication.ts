"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import {
  buildWelcomeEmail,
  sendWelcomeEmail,
} from "@/lib/email/welcomeEmail";
import type { ApplicationPain } from "@/lib/types";

type ApproveResult = { ok: true } | { ok?: false; error: string };

type ApplicationLifecycleRow = {
  id: string;
  email: string;
  pain: ApplicationPain;
  approved_at: string | null;
  rejected_at: string | null;
};

export async function approveApplication(
  applicationId: string,
): Promise<ApproveResult> {
  let founderId: string;
  try {
    const founder = await requireFounder();
    founderId = founder.id;
  } catch (err) {
    if (err instanceof FounderForbiddenError) return { error: "Forbidden." };
    throw err;
  }

  const supabase = createServiceClient();

  const { data: application } = await supabase
    .from("applications")
    .select("id, email, pain, approved_at, rejected_at")
    .eq("id", applicationId)
    .maybeSingle<ApplicationLifecycleRow>();

  if (!application) return { error: "Application not found." };
  if (application.approved_at) return { error: "Already approved." };
  if (application.rejected_at) return { error: "Application was rejected." };

  const inviteToken = randomUUID();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      approved_at: now,
      approved_by: founderId,
      invite_token: inviteToken,
      invite_sent_at: now,
    })
    .eq("id", applicationId);

  if (updateError) {
    console.error("approveApplication update failed", updateError);
    return { error: "Could not approve. Try again." };
  }

  // The /sign-in page does not yet read ?invite= and link the resulting
  // user back to applications.user_id. Until that handler ships, the
  // applicant signs in normally and the user_id link is a manual SQL
  // backfill. Tracked in roadmap.md under "Onboarding & lifecycle".
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tripcrew.app";
  const magicLinkUrl = `${baseUrl}/sign-in?invite=${inviteToken}`;

  try {
    await sendWelcomeEmail(
      buildWelcomeEmail({
        to: application.email,
        magicLinkUrl,
        pain: application.pain,
      }),
    );
  } catch (err) {
    console.error("approveApplication email failed", err);
    // The DB write succeeded; surface the error so the founder retries
    // the email manually rather than re-approving and double-stamping.
    return { error: "Approved but email failed. Resend manually." };
  }

  revalidatePath("/admin/applications/queue");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function approveApplicationsBatch(
  ids: string[],
): Promise<
  | { ok: true; approved: number; failed: number }
  | { ok?: false; error: string }
> {
  try {
    await requireFounder();
  } catch {
    return { error: "Forbidden." };
  }
  let approved = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await approveApplication(id);
    if ("ok" in result && result.ok) approved += 1;
    else failed += 1;
  }
  return { ok: true, approved, failed };
}
