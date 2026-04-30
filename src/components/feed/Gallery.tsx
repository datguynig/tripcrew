"use client";

import { useMemo, useState } from "react";
import type { Post } from "@/lib/types";
import { LikeToggle } from "./LikeToggle";
import { dayLabel, initials, timeLabel } from "./feedUtils";

type AuthorsMap = Record<string, { name: string; isFounder: boolean }>;

type Props = {
  /** Already filtered by image + author, newest first. */
  mediaPosts: Post[];
  /** Total media count before author filter — used for empty-state copy. */
  unfilteredCount: number;
  authors: Array<{ id: string; name: string; isFounder: boolean }>;
  authorFilter: string;
  onChangeFilter: (filter: string) => void;
  authorsById: AuthorsMap;
  likeCountFor: (postId: string) => number;
  likedByMe: (postId: string) => boolean;
  replyCountFor: (postId: string) => number;
  onToggleLike: (postId: string) => void;
  onOpenLightbox: (postId: string) => void;
  onViewInChat: (postId: string) => void;
};

type DayGroup = { label: string; items: Post[] };

function groupByDay(posts: Post[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const p of posts) {
    const label = dayLabel(p.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(p);
    } else {
      groups.push({ label, items: [p] });
    }
  }
  return groups;
}

export function Gallery({
  mediaPosts,
  unfilteredCount,
  authors,
  authorFilter,
  onChangeFilter,
  authorsById,
  likeCountFor,
  likedByMe,
  replyCountFor,
  onToggleLike,
  onOpenLightbox,
  onViewInChat,
}: Props) {
  const groups = useMemo(() => groupByDay(mediaPosts), [mediaPosts]);

  if (unfilteredCount === 0) {
    return (
      <div className="px-5 py-10">
        <div className="border border-line py-14 text-center label text-fg-3">
          No photos yet · share one
        </div>
      </div>
    );
  }

  const filterLabel =
    authorFilter === "all"
      ? null
      : authors.find((a) => a.id === authorFilter)?.name ?? null;

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 border-b border-line nav-scroll">
        <FilterPill
          label="ALL"
          active={authorFilter === "all"}
          onClick={() => onChangeFilter("all")}
        />
        {authors.map((a) => (
          <FilterPill
            key={a.id}
            label={a.name.toUpperCase()}
            active={authorFilter === a.id}
            onClick={() =>
              onChangeFilter(authorFilter === a.id ? "all" : a.id)
            }
          />
        ))}
      </div>

      {mediaPosts.length === 0 ? (
        <div className="px-5 py-10">
          <div className="border border-line py-14 text-center label text-fg-3">
            No photos from {filterLabel} yet
          </div>
        </div>
      ) : (
        <div className="px-5 py-6 space-y-8">
          {groups.map((g) => (
            <section key={g.label}>
              <div className="flex items-baseline gap-3 mb-3">
                <span
                  className="label-sm-wide text-fg-3"
                  suppressHydrationWarning
                >
                  {g.label}
                </span>
                <span className="label-xs text-fg-4 tabular">
                  · {g.items.length}
                </span>
              </div>
              <div className="bg-line grid grid-cols-3 max-[900px]:grid-cols-2 gap-px">
                {g.items.map((p) => (
                  <Thumb
                    key={p.id}
                    post={p}
                    authorName={
                      authorsById[p.author_id]?.name ?? "Unknown"
                    }
                    likeCount={likeCountFor(p.id)}
                    liked={likedByMe(p.id)}
                    replyCount={replyCountFor(p.id)}
                    onOpen={() => onOpenLightbox(p.id)}
                    onToggleLike={() => onToggleLike(p.id)}
                    onViewInChat={() => onViewInChat(p.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 label-xs py-[6px] px-[12px] border transition-colors cursor-pointer ${
        active
          ? "bg-accent text-bg border-accent"
          : "bg-bg-2 text-fg-3 border-line hover:border-line-2 hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

type ThumbProps = {
  post: Post;
  authorName: string;
  likeCount: number;
  liked: boolean;
  replyCount: number;
  onOpen: () => void;
  onToggleLike: () => void;
  onViewInChat: () => void;
};

function Thumb({
  post,
  authorName,
  likeCount,
  liked,
  replyCount,
  onOpen,
  onToggleLike,
  onViewInChat,
}: ThumbProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  return (
    <div className="relative group bg-bg-3 aspect-[4/3] overflow-hidden">
      {!imageBroken ? (
        <>
          {!imageLoaded && (
            <div
              className="absolute inset-0 bg-bg-3 animate-skeleton"
              aria-hidden="true"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url as string}
            alt=""
            loading="lazy"
            className={`w-full h-full object-cover block transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageBroken(true)}
          />
        </>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center label text-fg-3 bg-bg-3"
          aria-hidden="true"
        >
          Image unavailable
        </div>
      )}

      {/* Cover button — opens lightbox. Sits above the image but below
          the overlay's interactive children via z/pointer-events. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Photo by ${authorName}, ${timeLabel(post.created_at)}`}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-offset-[-3px]"
      />

      {/* Overlay — content is above the cover. Non-interactive regions use
          pointer-events-none so clicks on them fall through to the cover. */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-3 flex items-end justify-between gap-2 bg-bg/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity max-[780px]:opacity-80 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className="h-6 w-6 flex items-center justify-center border border-line-2 label-xs text-fg bg-bg-2/80 shrink-0"
          >
            {initials(authorName)}
          </span>
          <span
            className="label-xs text-fg-2 tabular whitespace-nowrap"
            suppressHydrationWarning
          >
            {timeLabel(post.created_at)}
          </span>
          <LikeToggle
            liked={liked}
            count={likeCount}
            onToggle={onToggleLike}
            compact
            className="pointer-events-auto"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {replyCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewInChat();
              }}
              aria-label={`${replyCount} replies in chat`}
              className="label-xs text-fg-2 hover:text-fg cursor-pointer tabular pointer-events-auto"
            >
              ↵ {replyCount}
            </button>
          )}
          <span
            aria-hidden="true"
            className="label-xs text-accent whitespace-nowrap"
          >
            VIEW ↗
          </span>
        </div>
      </div>
    </div>
  );
}
