"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const voteSchema = z.object({
  activityId: z.string().uuid(),
  vote: z.enum(["yes", "maybe", "no"]).nullable(),
});

export async function castVote(input: {
  activityId: string;
  vote: "yes" | "maybe" | "no" | null;
}) {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid vote" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (parsed.data.vote === null) {
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("activity_id", parsed.data.activityId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("votes").upsert(
      {
        activity_id: parsed.data.activityId,
        user_id: user.id,
        vote: parsed.data.vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,user_id" },
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/shortlist");
  return { ok: true };
}
