"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addPost,
  deletePost,
  editPost,
  togglePostLike,
} from "@/lib/actions/feed";
import { useToast } from "@/hooks/useToast";

import type { Post, PostLike } from "@/lib/types";
import { DaySeparator } from "./DaySeparator";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, type ReplyTarget } from "./MessageComposer";
import { dayLabel, isGrouped, needsDaySeparator } from "./feedUtils";

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    setPosts([...initial].sort(ascByCreatedAt));
  }, [initial]);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

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
    const channel = supabase
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
          setPosts((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Post;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, row];
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

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
          likeCount={likeIndex.counts.get(p.id) ?? 0}
          liked={likeIndex.mine.has(p.id)}
          canEdit={canEdit}
          replyPreview={replyPreview}
          onDelete={isOwn ? () => handleDelete(p.id) : undefined}
          onToggleLike={() => handleToggleLike(p.id)}
          onReply={() => handleReply(p)}
          onEditCommit={(next) => handleEdit(p.id, next)}
          onScrollToPost={handleScrollToPost}
        />,
      );
      prev = p;
    }
  }

  return (
    <div className="border border-line">
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
      <MessageComposer
        sending={isPosting}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
        onSend={handleSend}
      />
    </div>
  );
}
