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
