"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import {
  buildApplicationSoftRejectedEmail,
  sendApplicationSoftRejected,
} from "@/lib/email/teaserEmails";

type RejectResult = { ok: true } | { ok?: false; error: string };

export async function rejectApplication(
  applicationId: string,
): Promise<RejectResult> {
  let founderId: string;
  try {
    const founder = await requireFounder();
    founderId = founder.id;
  } catch (err) {
    if (err instanceof FounderForbiddenError) return { error: "Forbidden." };
    throw err;
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Read the email up front so the after() hook has it even if the
  // update raced with a concurrent edit. We constrain the update to
  // approved_at IS NULL so an already-approved row stays untouched.
  const { data: application } = await supabase
    .from("applications")
    .select("email, approved_at")
    .eq("id", applicationId)
    .maybeSingle<{ email: string; approved_at: string | null }>();

  if (!application) return { error: "Application not found." };
  if (application.approved_at) return { error: "Application is already approved." };

  const { error } = await supabase
    .from("applications")
    .update({
      rejected_at: now,
      rejected_by: founderId,
      decision_finalised_at: now,
      decision_finalised_by: "admin",
    })
    .eq("id", applicationId)
    .is("approved_at", null);

  if (error) {
    console.error("rejectApplication update failed", error);
    return { error: "Could not reject. Try again." };
  }

  const recipientEmail = application.email;
  after(async () => {
    try {
      await sendApplicationSoftRejected(
        buildApplicationSoftRejectedEmail({ email: recipientEmail }),
      );
    } catch (err) {
      console.error("rejectApplication: rejected-email send failed:", err);
    }
  });

  revalidatePath("/admin/applications/queue");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function updateAdminNotes(
  applicationId: string,
  notes: string,
): Promise<{ ok: true } | { ok?: false; error: string }> {
  try {
    await requireFounder();
  } catch {
    return { error: "Forbidden." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("applications")
    .update({ admin_notes: notes.slice(0, 4000) })
    .eq("id", applicationId);

  if (error) return { error: "Could not save notes." };
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}
