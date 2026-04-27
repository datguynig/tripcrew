"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
});

export type ProfileState = { error?: string } | undefined;

function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function createProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Name required (1–60 chars)." };

  const next = safeNext(formData.get("next"));

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

  redirect(next ?? "/dashboard");
}
