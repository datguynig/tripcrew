"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRIP_SLUG } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
});

export type ProfileState = { error?: string } | undefined;

export async function createProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Name required (1–60 chars)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error: insertErr } = await supabase
    .from("profiles")
    .insert({ id: user.id, name: parsed.data.name });

  if (insertErr && insertErr.code !== "23505") {
    console.error("profile insert error", insertErr);
    return { error: "Could not save profile." };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("slug", TRIP_SLUG)
    .single();

  if (trip) {
    const { error: memberErr } = await supabase
      .from("trip_members")
      .insert({ trip_id: trip.id, user_id: user.id });
    if (memberErr && memberErr.code !== "23505") {
      console.error("trip_member insert error", memberErr);
    }
  }

  redirect("/");
}
