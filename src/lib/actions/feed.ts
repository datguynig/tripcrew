"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createNotifications,
  tripMemberIdsExcept,
} from "@/lib/notifications";

const postSchema = z
  .object({
    tripId: z.string().uuid(),
    imageUrl: z.string().url().max(2000).nullable(),
    caption: z.string().max(1000).nullable(),
    replyToPostId: z.string().uuid().nullable(),
  })
  .refine(
    (v) =>
      v.imageUrl !== null ||
      (v.caption && v.caption.length > 0) ||
      v.replyToPostId !== null,
    { message: "Add an image, a caption, or reply to a message" },
  );

const editSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().min(1).max(1000),
});

const EDIT_WINDOW_MS = 5 * 60 * 1000;
const EXCERPT_MAX = 80;

function truncateExcerpt(text: string | null, imageUrl: string | null): string {
  if (text) {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length > EXCERPT_MAX
      ? `${clean.slice(0, EXCERPT_MAX - 1).trimEnd()}…`
      : clean;
  }
  if (imageUrl) return "📷 Photo";
  return "…";
}

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
  replyToPostId?: string | null;
}) {
  const cleaned = {
    tripId: input.tripId,
    imageUrl:
      input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    caption:
      input.caption && input.caption.trim() ? input.caption.trim() : null,
    replyToPostId: input.replyToPostId ?? null,
  };
  const parsed = postSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { error: "Add an image, a caption, or reply to a message" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // If this is a reply, verify the parent exists in the same trip. Stops
  // a malicious client from stitching a reply across trip boundaries.
  let replyToAuthorId: string | null = null;
  if (parsed.data.replyToPostId) {
    const { data: parent } = await supabase
      .from("posts")
      .select("trip_id, author_id")
      .eq("id", parsed.data.replyToPostId)
      .maybeSingle<{ trip_id: string; author_id: string }>();
    if (!parent || parent.trip_id !== parsed.data.tripId) {
      return { error: "Reply target not found" };
    }
    replyToAuthorId = parent.author_id;
  }

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      trip_id: parsed.data.tripId,
      image_url: parsed.data.imageUrl,
      caption: parsed.data.caption,
      author_id: user.id,
      reply_to_post_id: parsed.data.replyToPostId,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !inserted) return { error: error?.message ?? "Post failed" };

  const [{ data: actor }, { data: trip }, recipients] = await Promise.all([
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle<{ name: string | null }>(),
    supabase
      .from("trips")
      .select("name, slug")
      .eq("id", parsed.data.tripId)
      .maybeSingle<{ name: string; slug: string }>(),
    tripMemberIdsExcept(parsed.data.tripId, user.id),
  ]);

  await createNotifications({
    tripId: parsed.data.tripId,
    actorId: user.id,
    kind: "feed_message",
    entityId: inserted.id,
    payload: {
      actor_name: actor?.name ?? undefined,
      trip_name: trip?.name,
      trip_slug: trip?.slug,
      post_id: inserted.id,
      reply_to_post_id: parsed.data.replyToPostId,
      reply_to_author_id: replyToAuthorId,
      excerpt: truncateExcerpt(parsed.data.caption, parsed.data.imageUrl),
    },
    recipients,
    coalesceByActorAndTrip: true,
  });

  await revalidateTrip(parsed.data.tripId);
  return { ok: true };
}

export async function editPost(input: { id: string; caption: string }) {
  const parsed = editSchema.safeParse({
    id: input.id,
    caption: input.caption.trim(),
  });
  if (!parsed.success) return { error: "Invalid edit" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Defence-in-depth: RLS also enforces both author and the 5-minute
  // window, but check here so we return a precise error instead of a
  // silent "0 rows updated".
  const { data: existing } = await supabase
    .from("posts")
    .select("author_id, created_at, trip_id")
    .eq("id", parsed.data.id)
    .maybeSingle<{ author_id: string; created_at: string; trip_id: string }>();
  if (!existing) return { error: "Post not found" };
  if (existing.author_id !== user.id) {
    return { error: "Only the author can edit this post" };
  }
  if (Date.now() - Date.parse(existing.created_at) > EDIT_WINDOW_MS) {
    return { error: "Edit window has passed" };
  }

  const { error } = await supabase
    .from("posts")
    .update({ caption: parsed.data.caption, edited_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await revalidateTrip(existing.trip_id);
  return { ok: true };
}

export async function togglePostLike(postId: string) {
  const parsed = z.string().uuid().safeParse(postId);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle<{ post_id: string }>();

  if (existing) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", parsed.data)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    return { ok: true, liked: false };
  }

  const { error } = await supabase
    .from("post_likes")
    .insert({ post_id: parsed.data, user_id: user.id });
  if (error) return { error: error.message };
  return { ok: true, liked: true };
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
