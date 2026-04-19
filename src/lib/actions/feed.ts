"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const postSchema = z
  .object({
    tripId: z.string().uuid(),
    imageUrl: z.string().url().max(2000).nullable(),
    caption: z.string().max(1000).nullable(),
  })
  .refine((v) => v.imageUrl !== null || (v.caption && v.caption.length > 0), {
    message: "Add an image or a caption",
  });

async function revalidateTrip(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (data?.slug) revalidatePath(`/trips/${data.slug}/feed`);
}

function storagePathFromUrl(url: string): string | null {
  const marker = "/post-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function addPost(input: {
  tripId: string;
  imageUrl: string | null;
  caption: string | null;
}) {
  const cleaned = {
    tripId: input.tripId,
    imageUrl:
      input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    caption: input.caption && input.caption.trim() ? input.caption.trim() : null,
  };
  const parsed = postSchema.safeParse(cleaned);
  if (!parsed.success) return { error: "Add an image or a caption" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("posts").insert({
    trip_id: parsed.data.tripId,
    image_url: parsed.data.imageUrl,
    caption: parsed.data.caption,
    author_id: user.id,
  });
  if (error) return { error: error.message };

  await revalidateTrip(parsed.data.tripId);
  return { ok: true };
}

export async function deletePost(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", parsed.data)
    .eq("author_id", user.id)
    .select("trip_id, image_url")
    .maybeSingle<{ trip_id: string; image_url: string | null }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Only the author can delete this post" };

  // Best-effort storage cleanup. If the image lives in our bucket,
  // remove it so orphans don't accumulate. A failure here isn't fatal
  // because the row is already gone.
  if (data.image_url) {
    const path = storagePathFromUrl(data.image_url);
    if (path) {
      await supabase.storage.from("post-images").remove([path]);
    }
  }

  await revalidateTrip(data.trip_id);
  return { ok: true };
}
