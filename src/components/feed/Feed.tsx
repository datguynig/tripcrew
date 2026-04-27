"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addPost,
  deletePost,
  editPost,
  togglePostLike,
} from "@/lib/actions/feed";
import { markFeedRead } from "@/lib/actions/notifications";
import { useToast } from "@/hooks/useToast";

import type { Post, PostLike } from "@/lib/types";
import { DaySeparator } from "./DaySeparator";
import { Gallery } from "./Gallery";
import { Lightbox } from "./Lightbox";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, type ReplyTarget } from "./MessageComposer";
import { dayLabel, isGrouped, needsDaySeparator } from "./feedUtils";

type ViewMode = "timeline" | "gallery";

type CrewMap = Record<string, string>;

type Props = {
  initial: Post[];
  initialLikes: PostLike[];
  authorsById: CrewMap;
  tripId: string;
  currentUserId: string;
};

const AT_BOTTOM_THRESHOLD = 80;
const EDIT_WINDOW_MS = 5 * 60 * 1000;
const EXCERPT_MAX = 80;

function ascByCreatedAt(a: Post, b: Post): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function excerptFromPost(p: Post): string {
  const base = p.caption ?? (p.image_url ? "📷 Photo" : "…");
  const clean = base.replace(/\s+/g, " ").trim();
  return clean.length > EXCERPT_MAX
    ? `${clean.slice(0, EXCERPT_MAX - 1).trimEnd()}…`
    : clean;
}

export function Feed({
  initial,
  initialLikes,
  authorsById,
  tripId,
  currentUserId,
}: Props) {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>(() =>
    [...initial].sort(ascByCreatedAt),
  );
  const [likes, setLikes] = useState<PostLike[]>(initialLikes);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isPosting, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [lightbox, setLightbox] = useState<{
    postId: string;
    source: "gallery" | "timeline";
  } | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  // Time-relative flags (canEdit, day labels rendered via sub-components)
  // depend on the local clock. Gate them behind a post-mount flag so the
  // server and first client render stay identical; real values show up
  // on the second render after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const markReadTimerRef = useRef<number | null>(null);

  // Drain any unread feed_message notifications for this trip. Called
  // on mount, on visibility-return, and (debounced) on incoming realtime
  // inserts. The bell should not light up for messages the user is
  // already reading live.
  const scheduleMarkRead = useCallback(
    (immediate = false) => {
      if (immediate) {
        if (markReadTimerRef.current !== null) {
          window.clearTimeout(markReadTimerRef.current);
          markReadTimerRef.current = null;
        }
        void markFeedRead(tripId);
        return;
      }
      if (markReadTimerRef.current !== null) return;
      markReadTimerRef.current = window.setTimeout(() => {
        markReadTimerRef.current = null;
        void markFeedRead(tripId);
      }, 1000);
    },
    [tripId],
  );

  useEffect(() => {
    setPosts([...initial].sort(ascByCreatedAt));
  }, [initial]);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  useEffect(() => {
    scheduleMarkRead(true);
    const onVis = () => {
      if (document.visibilityState === "visible") scheduleMarkRead(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [scheduleMarkRead]);

  useEffect(() => {
    const scrollToHashPost = () => {
      if (typeof window === "undefined") return false;
      const hash = window.location.hash;
      if (!hash.startsWith("#post-")) return false;
      const el = document.getElementById(hash.slice(1));
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-accent-dim");
      setTimeout(() => el.classList.remove("bg-accent-dim"), 1200);
      return true;
    };

    if (!scrollToHashPost()) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }

    window.addEventListener("hashchange", scrollToHashPost);
    return () => window.removeEventListener("hashchange", scrollToHashPost);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Await auth before subscribing so the realtime websocket carries a
    // JWT. Without it, Postgres Changes silently drops RLS-gated events
    // for this listener — the bell works because its own hook uses the
    // same pattern, but this one was missing it.
    void (async () => {
      await supabase.auth.getUser();

      channel = supabase
        .channel(`rt:feed:${tripId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "posts",
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Post;
              if (row.author_id !== currentUserId) scheduleMarkRead();
            }
            setPosts((prev) => {
              if (payload.eventType === "INSERT") {
                const row = payload.new as Post;
                if (prev.some((p) => p.id === row.id)) return prev;
                return [...prev, row];
              }
              if (payload.eventType === "UPDATE") {
                const row = payload.new as Partial<Post> & { id: string };
                return prev.map((p) =>
                  p.id === row.id ? { ...p, ...row } : p,
                );
              }
              if (payload.eventType === "DELETE") {
                const row = payload.old as { id?: string };
                return prev.filter((p) => p.id !== row.id);
              }
              return prev;
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "post_likes" },
          (payload) => {
            setLikes((prev) => {
              if (payload.eventType === "INSERT") {
                const row = payload.new as PostLike;
                if (
                  prev.some(
                    (l) =>
                      l.post_id === row.post_id && l.user_id === row.user_id,
                  )
                ) {
                  return prev;
                }
                return [...prev, row];
              }
              if (payload.eventType === "DELETE") {
                const row = payload.old as {
                  post_id?: string;
                  user_id?: string;
                };
                return prev.filter(
                  (l) =>
                    !(l.post_id === row.post_id && l.user_id === row.user_id),
                );
              }
              return prev;
            });
          },
        )
        .subscribe((status) => {
          // Catch-up fetch on subscribe success — closes the SSR-to-
          // SUBSCRIBED gap where after()-fired UPDATEs are otherwise lost.
          if (status !== "SUBSCRIBED") return;
          void (async () => {
            const { data: postsData } = await supabase
              .from("posts")
              .select(
                "id, trip_id, image_url, caption, author_id, created_at, reply_to_post_id, edited_at",
              )
              .eq("trip_id", tripId)
              .order("created_at", { ascending: false })
              .limit(200)
              .returns<Post[]>();
            if (postsData) setPosts([...postsData].sort(ascByCreatedAt));

            const ids = (postsData ?? []).map((p) => p.id);
            if (ids.length === 0) return;
            const { data: likesData } = await supabase
              .from("post_likes")
              .select("post_id, user_id, created_at")
              .in("post_id", ids)
              .returns<PostLike[]>();
            if (likesData) setLikes(likesData);
          })();
        });
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId, currentUserId, scheduleMarkRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [posts]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < AT_BOTTOM_THRESHOLD;
  };

  const handleSend = useCallback(
    (input: { imageUrl: string | null; caption: string | null }) => {
      atBottomRef.current = true;
      const reply = replyTarget;
      setReplyTarget(null);
      startTransition(async () => {
        const res = await addPost({
          tripId,
          imageUrl: input.imageUrl,
          caption: input.caption,
          replyToPostId: reply?.postId ?? null,
        });
        if (res?.error) {
          toast.error(res.error);
          if (reply) setReplyTarget(reply);
        }
      });
    },
    [replyTarget, tripId, toast],
  );

  const handleDelete = (id: string) => {
    const removed = posts.find((p) => p.id === id);
    if (!removed) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.undo({
      message: "Message removed",
      duration: 5000,
      onUndo: () =>
        setPosts((prev) => [...prev, removed].sort(ascByCreatedAt)),
      onCommit: () =>
        startTransition(async () => {
          const res = await deletePost(id);
          if (res?.error) {
            toast.error(res.error);
            setPosts((prev) => [...prev, removed].sort(ascByCreatedAt));
          }
        }),
    });
  };

  const handleToggleLike = (postId: string) => {
    const wasLiked = likes.some(
      (l) => l.post_id === postId && l.user_id === currentUserId,
    );
    // Optimistic update
    setLikes((prev) => {
      if (wasLiked) {
        return prev.filter(
          (l) => !(l.post_id === postId && l.user_id === currentUserId),
        );
      }
      return [
        ...prev,
        {
          post_id: postId,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        },
      ];
    });
    startTransition(async () => {
      const res = await togglePostLike(postId);
      if (res?.error) {
        toast.error(res.error);
        // Rollback
        setLikes((prev) => {
          if (wasLiked) {
            return [
              ...prev,
              {
                post_id: postId,
                user_id: currentUserId,
                created_at: new Date().toISOString(),
              },
            ];
          }
          return prev.filter(
            (l) => !(l.post_id === postId && l.user_id === currentUserId),
          );
        });
      }
    });
  };

  const handleReply = (post: Post) => {
    setReplyTarget({
      postId: post.id,
      authorName: authorsById[post.author_id] ?? "Unknown",
      excerpt: excerptFromPost(post),
    });
  };

  const handleEdit = async (postId: string, nextCaption: string) => {
    const res = await editPost({ id: postId, caption: nextCaption });
    if (res?.error) {
      toast.error(res.error);
      return false;
    }
    return true;
  };

  const handleScrollToPost = (postId: string) => {
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-accent-dim");
      setTimeout(() => el.classList.remove("bg-accent-dim"), 1200);
    }
  };

  // Build lookup maps for O(1) access inside the render loop.
  const likeIndex = useMemo(() => {
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const l of likes) {
      counts.set(l.post_id, (counts.get(l.post_id) ?? 0) + 1);
      if (l.user_id === currentUserId) mine.add(l.post_id);
    }
    return { counts, mine };
  }, [likes, currentUserId]);

  const postsById = useMemo(() => {
    const m = new Map<string, Post>();
    for (const p of posts) m.set(p.id, p);
    return m;
  }, [posts]);

  const replyCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      if (!p.reply_to_post_id) continue;
      m.set(p.reply_to_post_id, (m.get(p.reply_to_post_id) ?? 0) + 1);
    }
    return m;
  }, [posts]);

  const likeCountFor = useCallback(
    (postId: string) => likeIndex.counts.get(postId) ?? 0,
    [likeIndex],
  );
  const likedByMe = useCallback(
    (postId: string) => likeIndex.mine.has(postId),
    [likeIndex],
  );
  const replyCountFor = useCallback(
    (postId: string) => replyCountByParent.get(postId) ?? 0,
    [replyCountByParent],
  );

  // Timeline view takes a tick to mount its scroll container after a
  // mode flip. One rAF fires before React commits state; use double rAF
  // so the target bubble exists in the DOM before we try to scroll to it.
  const scheduleScrollToPost = (postId: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => handleScrollToPost(postId));
    });
  };

  const handleGalleryViewInChat = (postId: string) => {
    setLightbox(null);
    setViewMode("timeline");
    scheduleScrollToPost(postId);
  };

  const handleGalleryReplyInChat = (postId: string) => {
    const post = postsById.get(postId);
    if (!post) {
      toast.error("This post is no longer available");
      setLightbox(null);
      return;
    }
    setLightbox(null);
    setViewMode("timeline");
    handleReply(post);
    scheduleScrollToPost(postId);
  };

  const mediaPosts = useMemo(
    () =>
      [...posts]
        .filter((p) => p.image_url)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        ),
    [posts],
  );

  const galleryAuthors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of mediaPosts) {
      if (!seen.has(p.author_id)) {
        seen.set(p.author_id, authorsById[p.author_id] ?? "Unknown");
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [mediaPosts, authorsById]);

  const filteredMedia = useMemo(
    () =>
      authorFilter === "all"
        ? mediaPosts
        : mediaPosts.filter((p) => p.author_id === authorFilter),
    [mediaPosts, authorFilter],
  );

  const rendered: React.ReactNode[] = [];
  {
    let prev: Post | null = null;
    const now = Date.now();
    for (const p of posts) {
      if (needsDaySeparator(p, prev)) {
        rendered.push(
          <DaySeparator key={`sep-${p.id}`} label={dayLabel(p.created_at)} />,
        );
      }
      const isOwn = p.author_id === currentUserId;
      const canEdit =
        mounted &&
        isOwn &&
        p.caption !== null &&
        now - Date.parse(p.created_at) < EDIT_WINDOW_MS;
      const parent = p.reply_to_post_id
        ? postsById.get(p.reply_to_post_id) ?? null
        : null;
      const replyPreview = p.reply_to_post_id
        ? {
            authorName: parent
              ? authorsById[parent.author_id] ?? "Unknown"
              : "Unknown",
            excerpt: parent ? excerptFromPost(parent) : "…",
          }
        : null;

      rendered.push(
        <MessageBubble
          key={p.id}
          post={p}
          authorName={authorsById[p.author_id] ?? "Unknown"}
          isOwn={isOwn}
          grouped={isGrouped(p, prev)}
          likeCount={likeCountFor(p.id)}
          liked={likedByMe(p.id)}
          canEdit={canEdit}
          replyPreview={replyPreview}
          onDelete={isOwn ? () => handleDelete(p.id) : undefined}
          onToggleLike={() => handleToggleLike(p.id)}
          onReply={() => handleReply(p)}
          onEditCommit={(next) => handleEdit(p.id, next)}
          onScrollToPost={handleScrollToPost}
          onOpenLightbox={(id) =>
            setLightbox({ postId: id, source: "timeline" })
          }
        />,
      );
      prev = p;
    }
  }

  return (
    <>
      <div className="border border-line">
        <div
          aria-label="Feed view"
          className="flex items-center gap-1 border-b border-line px-5 pt-3 pb-4"
        >
          {(["timeline", "gallery"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={viewMode === m}
              onClick={() => setViewMode(m)}
              className={`relative label-sm-wide px-3 py-3 transition-colors cursor-pointer ${
                viewMode === m ? "text-fg" : "text-fg-3 hover:text-fg-2"
              }`}
            >
              {m === "timeline" ? "TIMELINE" : "GALLERY"}
              {viewMode === m && (
                <span
                  aria-hidden="true"
                  className="absolute left-3 right-3 -bottom-4 h-[2px] bg-accent"
                />
              )}
            </button>
          ))}
          {viewMode === "gallery" && (
            <span className="ml-auto label-xs text-fg-3 tabular">
              {mediaPosts.length}{" "}
              {mediaPosts.length === 1 ? "photo" : "photos"}
            </span>
          )}
        </div>

        {viewMode === "timeline" ? (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[min(70vh,720px)] overflow-y-auto px-5"
          >
            {posts.length === 0 ? (
              <div className="h-full flex items-center justify-center label text-fg-3">
                No messages yet · be the first
              </div>
            ) : (
              rendered
            )}
          </div>
        ) : (
          <div className="h-[min(70vh,720px)] overflow-y-auto">
            <Gallery
              mediaPosts={filteredMedia}
              unfilteredCount={mediaPosts.length}
              authors={galleryAuthors}
              authorFilter={authorFilter}
              onChangeFilter={setAuthorFilter}
              authorsById={authorsById}
              likeCountFor={likeCountFor}
              likedByMe={likedByMe}
              replyCountFor={replyCountFor}
              onToggleLike={handleToggleLike}
              onOpenLightbox={(id) =>
                setLightbox({ postId: id, source: "gallery" })
              }
              onViewInChat={handleGalleryViewInChat}
            />
          </div>
        )}

        <MessageComposer
          sending={isPosting}
          replyTarget={replyTarget}
          onClearReply={() => setReplyTarget(null)}
          onSend={handleSend}
        />
      </div>

      {lightbox && (
        <Lightbox
          posts={lightbox.source === "gallery" ? filteredMedia : mediaPosts}
          currentPostId={lightbox.postId}
          authorsById={authorsById}
          likeCountFor={likeCountFor}
          likedByMe={likedByMe}
          replyCountFor={replyCountFor}
          onClose={() => setLightbox(null)}
          onToggleLike={handleToggleLike}
          onViewInChat={handleGalleryViewInChat}
          onReplyInChat={handleGalleryReplyInChat}
        />
      )}
    </>
  );
}
