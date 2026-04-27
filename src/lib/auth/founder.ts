import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type FounderProfile =
  | { id: string; name: string | null; is_founder: boolean }
  | null
  | undefined;

export class FounderForbiddenError extends Error {
  constructor() {
    super("FOUNDER_FORBIDDEN");
    this.name = "FounderForbiddenError";
  }
}

export function isFounderProfile(profile: FounderProfile): boolean {
  return !!profile && profile.is_founder === true;
}

export const requireFounder = cache(async (): Promise<{ id: string }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new FounderForbiddenError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_founder")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_founder: boolean }>();

  if (!profile || !profile.is_founder) {
    throw new FounderForbiddenError();
  }
  return { id: user.id };
});
