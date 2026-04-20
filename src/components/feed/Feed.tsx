"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPost, deletePost } from "@/lib/actions/feed";
import { useToast } from "@/hooks/useToast";

import type { Post } from "@/lib/types";
import { DaySeparator } from "./DaySeparator";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, type ReplyTarget } from "./MessageComposer";
import { dayLabel, isGrouped, needsDaySeparator } from "./feedUtils";

type CrewMap = Record<string, string>;

type Props = {
  initial: Post[];
  authorsById: CrewMap;
  tripId: string;
  currentUserId: string;
};

const AT_BOTTOM_THRESHOLD = 80;

function ascByCreatedAt(a: Post, b: Post): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function Feed({ initial, authorsById, tripId, currentUserId }: Props) {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>(() =>
    [...initial].sort(ascByCreatedAt),
  );
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isPosting, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    setPosts([...initial].sort(ascByCreatedAt));
  }, [initial]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

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

  const rendered: React.ReactNode[] = [];
  {
    let prev: Post | null = null;
    for (const p of posts) {
      if (needsDaySeparator(p, prev)) {
        rendered.push(
          <DaySeparator key={`sep-${p.id}`} label={dayLabel(p.created_at)} />,
        );
      }
      rendered.push(
        <MessageBubble
          key={p.id}
          post={p}
          authorName={authorsById[p.author_id] ?? "Unknown"}
          isOwn={p.author_id === currentUserId}
          grouped={isGrouped(p, prev)}
          likeCount={0}
          liked={false}
          onDelete={
            p.author_id === currentUserId ? () => handleDelete(p.id) : undefined
          }
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
