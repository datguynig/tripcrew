"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";

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

  const { error } = await supabase
    .from("applications")
    .update({
      rejected_at: now,
      rejected_by: founderId,
    })
    .eq("id", applicationId)
    .is("approved_at", null);

  if (error) {
    console.error("rejectApplication update failed", error);
    return { error: "Could not reject. Try again." };
  }

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
