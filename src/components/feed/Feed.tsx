"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPost } from "@/lib/actions/feed";

import type { Post } from "@/lib/types";

type CrewMap = Record<string, string>;

type Props = {
  initial: Post[];
  authorsById: CrewMap;
  tripId: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

export function Feed({ initial, authorsById, tripId }: Props) {
  const [posts, setPosts] = useState<Post[]>(initial);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => setPosts(initial), [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rt:posts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setPosts((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Post;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Post;
              return prev.map((p) => (p.id === row.id ? row : p));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const handlePost = () => {
    const trimmedUrl = url.trim();
    const trimmedCap = caption.trim();
    if (!trimmedUrl && !trimmedCap) return;
    setUrl("");
    setCaption("");
    startTransition(async () => {
      await addPost({
        tripId,
        imageUrl: trimmedUrl || null,
        caption: trimmedCap || null,
      });
    });
  };

  return (
    <>
      <div className="border border-line p-[18px] px-5 mb-7 grid gap-[10px]">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3"
        />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption, update, one-liner..."
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 min-h-[72px] leading-[1.5] resize-y"
        />
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            className="bg-fg text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer active:scale-[0.98]"
          >
            Post
          </button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="border border-line py-14 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          Feed empty · first to post wins
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {posts.map((p) => {
            const hasImage = p.image_url && !brokenImages.has(p.id);
            return (
              <div
                key={p.id}
                className="border border-line bg-bg-2 flex flex-col overflow-hidden"
              >
                {hasImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url as string}
                    alt=""
                    className="w-full aspect-[4/3] object-cover block bg-bg-3"
                    onError={() =>
                      setBrokenImages((prev) => new Set(prev).add(p.id))
                    }
                  />
                )}
                <div className="p-[14px] px-4 flex-1 flex flex-col">
                  {p.caption && (
                    <div className="text-sm leading-[1.5] text-fg flex-1 mb-3">
                      {p.caption}
                    </div>
                  )}
                  <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-fg-3 flex justify-between">
                    <span>{authorsById[p.author_id] ?? "Unknown"}</span>
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
