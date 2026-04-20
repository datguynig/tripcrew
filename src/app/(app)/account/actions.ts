"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8).max(200),
});

export type UpdatePasswordState =
  | { ok?: true; error?: string }
  | undefined;

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = schema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("update password error", error);
    return { error: error.message };
  }

  revalidatePath("/account");
  return { ok: true };
}
