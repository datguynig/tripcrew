"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const magicSchema = z.object({
  email: z.string().email().min(5).max(200),
});

const passwordSchema = z.object({
  email: z.string().email().min(5).max(200),
  password: z.string().min(8).max(200),
});

export type SignInState = { ok?: true; error?: string } | undefined;

async function getRedirectOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = magicSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Valid email required." };

  const supabase = await createClient();
  const redirectTo = `${await getRedirectOrigin()}/callback`;

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

export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Email and password required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.error("password sign-in error", error);
    return { error: "Wrong email or password." };
  }

  redirect("/");
}

export async function signUpWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Email and a password of 8+ characters required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    console.error("password sign-up error", error);
    return { error: error.message };
  }

  if (!data.session) {
    return { error: "Signed up but no session. Try signing in." };
  }

  redirect("/profile");
}
