"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";
import { initials, timeLabel } from "./feedUtils";

type Props = {
  post: Post;
  authorName: string;
  isOwn: boolean;
  grouped: boolean;
  likeCount: number;
  liked: boolean;
  onDelete?: () => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function Footer({
  likeCount,
  liked,
}: {
  likeCount: number;
  liked: boolean;
}) {
  return (
    <div className="flex gap-4 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        type="button"
        aria-label="Like message"
        className={`flex items-center gap-[6px] label-xs cursor-pointer transition-colors ${
          liked ? "text-accent" : "text-fg-3 hover:text-fg"
        }`}
      >
        <HeartIcon filled={liked} />
        <span className="tabular">{likeCount}</span>
      </button>
      <button
        type="button"
        aria-label="Reply to message"
        className="label-xs text-fg-3 hover:text-fg cursor-pointer transition-colors"
      >
        REPLY
      </button>
    </div>
  );
}

export function MessageBubble({
  post,
  authorName,
  isOwn,
  grouped,
  likeCount,
  liked,
  onDelete,
}: Props) {
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = post.image_url && !imageBroken;
  const imageMissing = post.image_url && imageBroken;

  const body = (
    <>
      {showImage && (
        <div className="max-w-[480px] border border-line bg-bg-2 overflow-hidden mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url as string}
            alt=""
            className="block w-full aspect-[4/3] object-cover bg-bg-3"
            onError={() => setImageBroken(true)}
          />
          {post.caption && (
            <div className="text-[15px] text-fg leading-[1.5] px-4 py-3 border-t border-line whitespace-pre-wrap break-words">
              {post.caption}
            </div>
          )}
        </div>
      )}
      {imageMissing && (
        <div className="max-w-[480px] aspect-[4/3] bg-bg-3 border border-line flex items-center justify-center label-sm text-fg-3 mt-1">
          Image unavailable
        </div>
      )}
      {!post.image_url && post.caption && (
        <div className="text-[15px] text-fg leading-[1.5] whitespace-pre-wrap break-words">
          {post.caption}
          {post.edited_at && (
            <span className="label-xs text-fg-3 ml-2">(edited)</span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      id={`post-${post.id}`}
      className={`group grid grid-cols-[32px_1fr] gap-3 -mx-2 px-2 transition-colors hover:bg-bg-2/40 relative ${
        grouped ? "py-[3px]" : "py-3"
      }`}
    >
      {grouped ? (
        <div
          aria-hidden="true"
          className="label-xs text-fg-3 tabular text-right pt-[3px] opacity-0 group-hover:opacity-100 transition-opacity self-start"
        >
          {timeLabel(post.created_at)}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={`h-8 w-8 flex items-center justify-center border label-xs ${
            isOwn
              ? "border-accent/40 text-accent"
              : "border-line bg-bg-2 text-fg-2"
          }`}
        >
          {initials(authorName)}
        </div>
      )}

      <div className="min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-[6px]">
            <span className="subheading text-fg">{authorName}</span>
            <span className="label-xs text-fg-3 tabular">
              {timeLabel(post.created_at)}
            </span>
            {post.edited_at && !post.image_url && post.caption && (
              <span className="label-xs text-fg-3">(edited)</span>
            )}
          </div>
        )}
        {body}
        <Footer likeCount={likeCount} liked={liked} />
      </div>

      {isOwn && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete message"
          className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center text-fg-3 hover:text-err transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
