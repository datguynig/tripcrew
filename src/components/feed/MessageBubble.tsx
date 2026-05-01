"use client";

import { useEffect, useRef, useState } from "react";
import { PioneerBadge } from "@/components/ui/PioneerBadge";
import type { Post } from "@/lib/types";
import { initials, timeLabel } from "./feedUtils";
import { HeartIcon } from "./LikeToggle";

type Props = {
  post: Post;
  authorName: string;
  authorIsFounder?: boolean;
  isOwn: boolean;
  grouped: boolean;
  likeCount: number;
  liked: boolean;
  canEdit: boolean;
  replyPreview: {
    authorName: string;
    authorIsFounder: boolean;
    excerpt: string;
  } | null;
  onDelete?: () => void;
  onToggleLike: () => void;
  onReply: () => void;
  onEditCommit: (next: string) => Promise<boolean>;
  onScrollToPost: (postId: string) => void;
  onOpenLightbox?: (postId: string) => void;
};

function Footer({
  likeCount,
  liked,
  canEdit,
  editing,
  onToggleLike,
  onReply,
  onStartEdit,
}: {
  likeCount: number;
  liked: boolean;
  canEdit: boolean;
  editing: boolean;
  onToggleLike: () => void;
  onReply: () => void;
  onStartEdit: () => void;
}) {
  if (editing) return null;
  return (
    <div className="flex gap-4 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity max-[780px]:opacity-80">
      <button
        type="button"
        aria-label={liked ? "Unlike message" : "Like message"}
        aria-pressed={liked}
        onClick={onToggleLike}
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
        onClick={onReply}
        className="label-xs text-fg-3 hover:text-fg cursor-pointer transition-colors"
      >
        REPLY
      </button>
      {canEdit && (
        <button
          type="button"
          aria-label="Edit message"
          onClick={onStartEdit}
          className="label-xs text-fg-3 hover:text-fg cursor-pointer transition-colors"
        >
          EDIT
        </button>
      )}
    </div>
  );
}

function ReplyQuote({
  authorName,
  authorIsFounder,
  excerpt,
  onScroll,
}: {
  authorName: string;
  authorIsFounder: boolean;
  excerpt: string;
  onScroll: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onScroll}
      className="flex flex-col items-start gap-[2px] border-l-2 border-accent pl-3 py-[2px] mb-[6px] text-left hover:bg-bg-2/60 transition-colors cursor-pointer w-full max-w-[480px]"
    >
      <span className="label-xs text-fg-3 inline-flex items-center gap-1.5">
        Replying to {authorName}
        {authorIsFounder ? <PioneerBadge size="sm" /> : null}
      </span>
      <span className="text-[13px] text-fg-2 truncate max-w-full">
        {excerpt}
      </span>
    </button>
  );
}

export function MessageBubble({
  post,
  authorName,
  authorIsFounder = false,
  isOwn,
  grouped,
  likeCount,
  liked,
  canEdit,
  replyPreview,
  onDelete,
  onToggleLike,
  onReply,
  onEditCommit,
  onScrollToPost,
  onOpenLightbox,
}: Props) {
  const [imageBroken, setImageBroken] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(post.caption ?? "");
  }, [post.caption, editing]);

  useEffect(() => {
    if (!editing || !textareaRef.current) return;
    const ta = textareaRef.current;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [editing]);

  const showImage = post.image_url && !imageBroken;
  const imageMissing = post.image_url && imageBroken;

  const commitEdit = async () => {
    if (saving) return;
    const trimmed = draft.trim();
    if (trimmed === (post.caption ?? "").trim()) {
      setEditing(false);
      return;
    }
    if (trimmed.length === 0) {
      setEditing(false);
      setDraft(post.caption ?? "");
      return;
    }
    setSaving(true);
    const ok = await onEditCommit(trimmed);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(post.caption ?? "");
    setEditing(false);
  };

  const editingTextarea = (
    <textarea
      ref={textareaRef}
      value={draft}
      disabled={saving}
      onChange={(e) => {
        setDraft(e.target.value);
        const ta = e.currentTarget;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void commitEdit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        }
      }}
      onBlur={() => void commitEdit()}
      className="w-full max-w-[640px] bg-transparent border-0 border-b border-accent outline-none text-[15px] text-fg leading-[1.5] resize-none py-1"
      aria-label="Edit message"
    />
  );

  const bodyContent = (
    <>
      {replyPreview && (
        <ReplyQuote
          authorName={replyPreview.authorName}
          authorIsFounder={replyPreview.authorIsFounder}
          excerpt={replyPreview.excerpt}
          onScroll={() => {
            if (post.reply_to_post_id) onScrollToPost(post.reply_to_post_id);
          }}
        />
      )}
      {showImage && (
        <div className="max-w-[480px] border border-line bg-bg-2 overflow-hidden mt-1">
          {onOpenLightbox ? (
            <button
              type="button"
              onClick={() => onOpenLightbox(post.id)}
              aria-label={`Open photo by ${authorName}`}
              className="block w-full cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url as string}
                alt=""
                className="block w-full aspect-[4/3] object-cover bg-bg-3"
                onError={() => setImageBroken(true)}
              />
            </button>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.image_url as string}
              alt=""
              className="block w-full aspect-[4/3] object-cover bg-bg-3"
              onError={() => setImageBroken(true)}
            />
          )}
          {editing ? (
            <div className="px-4 py-3 border-t border-line">
              {editingTextarea}
            </div>
          ) : (
            post.caption && (
              <div className="text-[15px] text-fg leading-[1.5] px-4 py-3 border-t border-line whitespace-pre-wrap break-words">
                {post.caption}
                {post.edited_at && (
                  <span className="label-xs text-fg-3 ml-2">(edited)</span>
                )}
              </div>
            )
          )}
        </div>
      )}
      {imageMissing && (
        <div className="max-w-[480px] aspect-[4/3] bg-bg-3 border border-line flex items-center justify-center label-sm text-fg-3 mt-1">
          Image unavailable
        </div>
      )}
      {!post.image_url &&
        (editing ? (
          editingTextarea
        ) : post.caption ? (
          <div className="text-[15px] text-fg leading-[1.5] whitespace-pre-wrap break-words">
            {post.caption}
            {post.edited_at && (
              <span className="label-xs text-fg-3 ml-2">(edited)</span>
            )}
          </div>
        ) : null)}
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
          suppressHydrationWarning
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
            <span className="subheading text-fg inline-flex items-center gap-2">
              {authorName}
              {authorIsFounder ? <PioneerBadge size="sm" /> : null}
            </span>
            <span className="label-xs text-fg-3 tabular" suppressHydrationWarning>
              {timeLabel(post.created_at)}
            </span>
            {post.edited_at && !post.image_url && post.caption && (
              <span className="label-xs text-fg-3">(edited)</span>
            )}
          </div>
        )}
        {bodyContent}
        {editing && (
          <div className="flex gap-3 mt-2 label-xs text-fg-3">
            <span>Enter to save · Esc to cancel</span>
          </div>
        )}
        <Footer
          likeCount={likeCount}
          liked={liked}
          canEdit={canEdit && !editing}
          editing={editing}
          onToggleLike={onToggleLike}
          onReply={onReply}
          onStartEdit={() => setEditing(true)}
        />
      </div>

      {isOwn && onDelete && !editing && (
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
