import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Feed } from "@/components/feed/Feed";
import type { Post, PostLike } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

  const supabase = await createClient();
  const [{ data: posts }, { data: members }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, trip_id, image_url, caption, author_id, created_at, reply_to_post_id, edited_at",
      )
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Post[]>(),
    supabase
      .from("trip_members")
      .select(
        "user_id, profiles!trip_members_user_id_fkey(name, founding_crew_at)",
      )
      .eq("trip_id", trip.id),
  ]);

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: likes } = postIds.length
    ? await supabase
        .from("post_likes")
        .select("post_id, user_id, created_at")
        .in("post_id", postIds)
        .returns<PostLike[]>()
    : { data: [] as PostLike[] };

  const authorsById: Record<string, { name: string; isFounder: boolean }> = {};
  for (const row of members ?? []) {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : (row.profiles as {
          name?: string;
          founding_crew_at?: string | null;
        } | null);
    if (profile?.name) {
      authorsById[row.user_id] = {
        name: profile.name,
        isFounder: !!profile.founding_crew_at,
      };
    }
  }

  const count = posts?.length ?? 0;

  const lead =
    trip.meta?.section_leads?.feed ??
    "Photos and dispatches from the trip. Upload a shot, add a line, post.";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code={`§ 06 · ${count} POSTS`}
        title="Feed."
        lead={lead}
      />
      <Feed
        initial={posts ?? []}
        initialLikes={likes ?? []}
        authorsById={authorsById}
        tripId={trip.id}
        currentUserId={user.id}
      />
    </section>
  );
}
