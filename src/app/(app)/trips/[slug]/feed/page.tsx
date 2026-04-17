import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Feed } from "@/components/feed/Feed";
import type { Post } from "@/lib/types";

export const revalidate = 0;

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
      .select("id, trip_id, image_url, caption, author_id, created_at")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false })
      .returns<Post[]>(),
    supabase
      .from("trip_members")
      .select("user_id, profiles(name)")
      .eq("trip_id", trip.id),
  ]);

  const authorsById: Record<string, string> = {};
  for (const row of members ?? []) {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : (row.profiles as { name?: string } | null);
    if (profile?.name) authorsById[row.user_id] = profile.name;
  }

  const count = posts?.length ?? 0;

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code={`§ 06 · ${count} POSTS`}
        title="Feed."
        lead="Photos and dispatches from the trip. Paste an image URL, add a line, post."
      />
      <Feed initial={posts ?? []} authorsById={authorsById} tripId={trip.id} />
    </section>
  );
}
