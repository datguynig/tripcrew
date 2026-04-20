"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import type { Post } from "@/lib/types";
import { LikeToggle } from "./LikeToggle";
import { dayLabel, initials, timeLabel } from "./feedUtils";

type Props = {
  posts: Post[];
  currentPostId: string;
  authorsById: Record<string, string>;
  likeCountFor: (postId: string) => number;
  likedByMe: (postId: string) => boolean;
  replyCountFor: (postId: string) => number;
  onClose: () => void;
  onToggleLike: (postId: string) => void;
  onReplyInChat: (postId: string) => void;
  onViewInChat: (postId: string) => void;
};

const SWIPE_THRESHOLD = 40;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function Lightbox({
  posts,
  currentPostId,
  authorsById,
  likeCountFor,
  likedByMe,
  replyCountFor,
  onClose,
  onToggleLike,
  onReplyInChat,
  onViewInChat,
}: Props) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      posts.findIndex((p) => p.id === currentPostId),
    ),
  );
  const [imageBroken, setImageBroken] = useState(false);
  const imageTouchStart = useRef<{ x: number; y: number } | null>(null);
  const panelTouchStart = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const post = posts[index];
  const hasPrev = index > 0;
  const hasNext = index < posts.length - 1;

  // Reset broken-image state whenever the viewed post changes.
  useEffect(() => {
    setImageBroken(false);
  }, [post?.id]);

  // If posts re-flow (e.g. realtime DELETE) keep the current post anchored
  // by id, not by index. If it vanishes entirely, close the overlay so
  // the caller's state can't outlive the data.
  useEffect(() => {
    if (!post) return;
    const newIndex = posts.findIndex((p) => p.id === post.id);
    if (newIndex === -1) {
      onClose();
      return;
    }
    if (newIndex !== index) setIndex(newIndex);
  }, [posts, post, index, onClose]);

  // Re-seek when the caller reopens with a different id without unmounting.
  useEffect(() => {
    const next = posts.findIndex((p) => p.id === currentPostId);
    if (next >= 0 && next !== index) setIndex(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPostId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        setIndex((i) => i - 1);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        setIndex((i) => i + 1);
      } else if (e.key === "Tab") {
        // Focus trap — keep keyboard focus inside the dialog.
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, [index]);

  if (!post || typeof document === "undefined") return null;

  const readSwipe = (
    ref: React.MutableRefObject<{ x: number; y: number } | null>,
    e: React.TouchEvent,
    allowDismiss: boolean,
  ) => {
    const start = ref.current;
    ref.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0 && hasNext) setIndex((i) => i + 1);
      else if (dx > 0 && hasPrev) setIndex((i) => i - 1);
    } else if (allowDismiss && dy > SWIPE_THRESHOLD * 1.5) {
      onClose();
    }
  };

  const onImageTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    imageTouchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onImageTouchEnd = (e: React.TouchEvent) => {
    readSwipe(imageTouchStart, e, true);
  };
  const onPanelTouchStart = (e: React.TouchEvent) => {
    // Only arm the swipe if the panel is scrolled to the top —
    // otherwise a swipe on long caption text should scroll, not dismiss.
    if ((panelRef.current?.scrollTop ?? 0) > 0) return;
    const t = e.touches[0];
    panelTouchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    readSwipe(panelTouchStart, e, true);
  };

  const authorName = authorsById[post.author_id] ?? "Unknown";
  const likeCount = likeCountFor(post.id);
  const liked = likedByMe(post.id);
  const replyCount = replyCountFor(post.id);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      onClick={onClose}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="fixed inset-0 z-[100] bg-bg/95 backdrop-blur-md flex flex-col max-[780px]:flex-col min-[781px]:grid min-[781px]:grid-cols-[3fr_2fr]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onImageTouchStart}
        onTouchEnd={onImageTouchEnd}
        className="relative flex-1 min-[781px]:h-full flex items-center justify-center min-h-0 group/img"
      >
        {!imageBroken ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.image_url as string}
            alt={post.caption ?? ""}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div className="flex items-center justify-center label text-fg-3 px-6 py-10">
            Image unavailable
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center text-fg bg-bg-2/60 backdrop-blur-sm border border-line hover:border-line-2 hover:bg-bg-2 transition-colors cursor-pointer"
        >
          ✕
        </button>

        {hasPrev && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-fg text-[18px] bg-bg-2/60 backdrop-blur-sm border border-line hover:border-line-2 hover:bg-bg-2 opacity-100 min-[781px]:opacity-0 min-[781px]:group-hover/img:opacity-100 min-[781px]:focus-within:opacity-100 transition-opacity cursor-pointer"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-fg text-[18px] bg-bg-2/60 backdrop-blur-sm border border-line hover:border-line-2 hover:bg-bg-2 opacity-100 min-[781px]:opacity-0 min-[781px]:group-hover/img:opacity-100 min-[781px]:focus-within:opacity-100 transition-opacity cursor-pointer"
          >
            ›
          </button>
        )}
      </div>

      <aside
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onPanelTouchStart}
        onTouchEnd={onPanelTouchEnd}
        className="bg-bg-2 border-t min-[781px]:border-t-0 min-[781px]:border-l border-line flex flex-col max-h-[55vh] min-[781px]:max-h-none overflow-hidden outline-none"
      >
        <div
          className="min-[781px]:hidden flex justify-center pt-2 pb-1"
          aria-hidden="true"
        >
          <span className="w-10 h-[2px] bg-line-2" />
        </div>
        <div className="px-5 py-4 border-b border-line flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-8 w-8 flex items-center justify-center border border-line label-xs text-fg-2 bg-bg-3 shrink-0"
          >
            {initials(authorName)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              id="lightbox-title"
              className="subheading text-fg truncate"
            >
              {authorName}
            </div>
            <div
              className="label-xs text-fg-3 tabular"
              suppressHydrationWarning
            >
              {dayLabel(post.created_at)} · {timeLabel(post.created_at)}
            </div>
          </div>
          <LikeToggle
            liked={liked}
            count={likeCount}
            onToggle={() => onToggleLike(post.id)}
          />
        </div>
        <div className="px-5 py-4 flex-1 overflow-y-auto">
          {post.caption ? (
            <p className="text-[15px] text-fg leading-[1.5] whitespace-pre-wrap break-words">
              {post.caption}
              {post.edited_at && (
                <span className="label-xs text-fg-3 ml-2">(edited)</span>
              )}
            </p>
          ) : (
            <p className="label-sm text-fg-3">No caption.</p>
          )}
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => onViewInChat(post.id)}
              className="mt-4 label-xs text-fg-3 hover:text-fg cursor-pointer tabular"
            >
              ↵ {replyCount} {replyCount === 1 ? "reply" : "replies"} in chat
            </button>
          )}
        </div>
        <div className="px-5 py-4 border-t border-line">
          <Button
            onClick={() => onReplyInChat(post.id)}
            className="w-full justify-center"
          >
            Reply in chat
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
