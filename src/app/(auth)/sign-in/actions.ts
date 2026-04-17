"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

const schema = z.object({
  email: z.string().email().min(5).max(200),
});

export type SignInState = { ok?: true; error?: string } | undefined;

export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Valid email required." };

  const supabase = await createClient();
  const host = (await headers()).get("host");
  const proto =
    process.env.NODE_ENV === "development" ? "http" : "https";
  const redirectTo = `${proto}://${host}/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    console.error("magic-link error", error);
    return { error: "Could not send the link. Try again." };
  }
  return { ok: true };
}
