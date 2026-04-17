"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TRIP_SLUG } from "@/lib/types";

const postSchema = z
  .object({
    imageUrl: z.string().url().max(2000).nullable(),
    caption: z.string().max(1000).nullable(),
  })
  .refine((v) => v.imageUrl !== null || (v.caption && v.caption.length > 0), {
    message: "Add an image or a caption",
  });

export async function addPost(input: {
  imageUrl: string | null;
  caption: string | null;
}) {
  const cleaned = {
    imageUrl: input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    caption: input.caption && input.caption.trim() ? input.caption.trim() : null,
  };
  const parsed = postSchema.safeParse(cleaned);
  if (!parsed.success) return { error: "Add an image or a caption" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("slug", TRIP_SLUG)
    .single();
  if (!trip) return { error: "Trip missing" };

  const { error } = await supabase.from("posts").insert({
    trip_id: trip.id,
    image_url: parsed.data.imageUrl,
    caption: parsed.data.caption,
    author_id: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/feed");
  return { ok: true };
}
