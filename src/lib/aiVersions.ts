import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Snapshots for the redraft undo/rollback feature.
 *
 * Every call to draftTripAction (force), redraftSection, or rerollRow
 * writes a pre-overwrite snapshot here so admins can preview + restore
 * one of the last 3 versions per surface via AIDraftHistory.
 *
 * All writes go through the service-role client (RLS on the table
 * only exposes reads to trip admins).
 */

export type DraftVersionSurface =
  | "spec_grid"
  | "schedule"
  | "activities"
  | "bookings"
  | "full";

const MAX_VERSIONS_PER_SURFACE = 3;

export async function recordDraftVersion(
  service: SupabaseClient,
  params: {
    tripId: string;
    surface: DraftVersionSurface;
    content: Record<string, unknown>;
    preview: string | null;
    userId: string | null;
  },
): Promise<void> {
  const { error } = await service.from("ai_draft_versions").insert({
    trip_id: params.tripId,
    surface: params.surface,
    content: params.content,
    preview: params.preview,
    created_by: params.userId,
  });
  if (error) {
    console.error("[aiVersions] insert failed", error);
    return;
  }
  // Cap per-surface history at MAX_VERSIONS_PER_SURFACE (keep newest).
  const { data: rows } = await service
    .from("ai_draft_versions")
    .select("id")
    .eq("trip_id", params.tripId)
    .eq("surface", params.surface)
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string }>>();
  const toDelete = (rows ?? []).slice(MAX_VERSIONS_PER_SURFACE).map((r) => r.id);
  if (toDelete.length > 0) {
    await service.from("ai_draft_versions").delete().in("id", toDelete);
  }
}

export function previewOf(surface: DraftVersionSurface, content: unknown): string {
  try {
    const c = content as Record<string, unknown>;
    if (surface === "spec_grid") {
      const cells = (c.spec_grid ?? []) as Array<{
        value?: string;
        amount?: number | null;
      }>;
      return cells
        .slice(0, 2)
        .map((x) => (typeof x.amount === "number" ? String(x.amount) : x.value ?? ""))
        .filter(Boolean)
        .join(" · ");
    }
    if (surface === "schedule") {
      const rows = (c.schedule ?? []) as Array<{ heading?: string }>;
      return rows
        .slice(0, 2)
        .map((r) => r.heading ?? "")
        .filter(Boolean)
        .join(" · ");
    }
    if (surface === "activities") {
      const rows = (c.activities ?? []) as Array<{ title?: string }>;
      return rows
        .slice(0, 3)
        .map((r) => r.title ?? "")
        .filter(Boolean)
        .join(" · ");
    }
    if (surface === "bookings") {
      const rows = (c.bookings ?? []) as Array<{ title?: string }>;
      return rows
        .slice(0, 3)
        .map((r) => r.title ?? "")
        .filter(Boolean)
        .join(" · ");
    }
    const hero = c.hero_title as string | undefined;
    if (hero) return hero;
    return "";
  } catch {
    return "";
  }
}
