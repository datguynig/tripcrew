import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export type PlacesEndpoint = "nearby" | "text" | "details";

const TTL_DAYS: Record<PlacesEndpoint, number> = {
  nearby: 7,
  text: 7,
  details: 30,
};

export function makeCacheKey(
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== null) acc[key] = value;
      return acc;
    }, {});

  const hash = createHash("sha256")
    .update(endpoint + JSON.stringify(sorted))
    .digest("hex")
    .slice(0, 32);

  return `${endpoint}:${hash}`;
}

export async function getCached<T>(
  endpoint: PlacesEndpoint,
  params: Record<string, unknown>,
): Promise<T | null> {
  const supabase = createServiceClient();
  const key = makeCacheKey(endpoint, params);

  const { data } = await supabase
    .from("places_cache")
    .select("response_data")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ response_data: T }>();

  return data?.response_data ?? null;
}

export async function setCached<T>(
  endpoint: PlacesEndpoint,
  params: Record<string, unknown>,
  data: T,
): Promise<void> {
  const supabase = createServiceClient();
  const key = makeCacheKey(endpoint, params);
  const expiresAt = new Date(
    Date.now() + TTL_DAYS[endpoint] * 86_400_000,
  ).toISOString();

  const { error } = await supabase.from("places_cache").upsert(
    {
      cache_key: key,
      endpoint,
      response_data: data,
      expires_at: expiresAt,
    },
    { onConflict: "cache_key" },
  );

  if (error) console.error("places cache write failed:", error);
}
