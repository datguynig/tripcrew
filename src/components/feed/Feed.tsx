"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPost, deletePost } from "@/lib/actions/feed";
import { uploadPostImage } from "@/lib/uploadImage";
import { useToast } from "@/hooks/useToast";

import type { Post } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { INPUT_SM } from "@/lib/styles";
import { DaySeparator } from "./DaySeparator";
import { MessageBubble } from "./MessageBubble";
import { dayLabel, isGrouped, needsDaySeparator } from "./feedUtils";

type CrewMap = Record<string, string>;

type Props = {
  initial: Post[];
  authorsById: CrewMap;
  tripId: string;
  currentUserId: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const AT_BOTTOM_THRESHOLD = 80;

export function Feed({ initial, authorsById, tripId, currentUserId }: Props) {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>(() =>
    [...initial].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  );
  const [caption, setCaption] = useState("");
  const [isPosting, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    setPosts(
      [...initial].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    );
  }, [initial]);

  // Scroll to bottom on mount so the newest messages are visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  // If the user is anchored to the bottom, keep them there when new
  // posts arrive. If they've scrolled up to read history, leave them
  // alone — pulling them back would be hostile.
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

  const handlePickFile = async (picked: File) => {
    setUploadError(null);
    setUploadedUrl(null);
    setFile(picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(picked));
    setUploading(true);
    const result = await uploadPostImage(picked);
    setUploading(false);
    if (result.ok) {
      setUploadedUrl(result.url);
    } else {
      setUploadError(result.message);
    }
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setUploadedUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const picked = e.dataTransfer.files?.[0];
    if (picked) handlePickFile(picked);
  };

  const canPost =
    !uploading &&
    !isPosting &&
    ((uploadedUrl !== null && !uploadError) || caption.trim().length > 0);

  const handlePost = () => {
    if (!canPost) return;
    const trimmedCap = caption.trim();
    const imageUrl = uploadedUrl;
    setCaption("");
    clearFile();
    atBottomRef.current = true;
    startTransition(async () => {
      const res = await addPost({
        tripId,
        imageUrl,
        caption: trimmedCap || null,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Sent");
      }
    });
  };

  const handleDelete = (id: string) => {
    const removed = posts.find((p) => p.id === id);
    if (!removed) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.undo({
      message: "Message removed",
      duration: 5000,
      onUndo: () =>
        setPosts((prev) =>
          [...prev, removed].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          ),
        ),
      onCommit: () =>
        startTransition(async () => {
          const res = await deletePost(id);
          if (res?.error) {
            toast.error(res.error);
            setPosts((prev) =>
              [...prev, removed].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              ),
            );
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
    <>
      <div className="border border-line p-[18px] px-5 mb-7 grid gap-[14px]">
        {file && previewUrl ? (
          <div className="border border-line bg-bg-2 flex items-stretch">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className={`w-[140px] h-[105px] object-cover bg-bg-3 transition-opacity ${
                uploading ? "opacity-50" : ""
              }`}
            />
            <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
              <div className="label-sm text-fg-2 truncate">{file.name}</div>
              <div className="label-sm text-fg-3">
                {uploading ? "Uploading…" : formatBytes(file.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={clearFile}
              disabled={uploading}
              aria-label="Remove photo"
              className="h-10 w-10 self-start flex items-center justify-center text-fg-3 hover:text-fg hover:bg-bg-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`block border border-dashed cursor-pointer py-10 text-center transition-colors focus-within:border-line-2 ${
              dragActive
                ? "border-accent/40 bg-accent/[0.03]"
                : "border-line hover:border-line-2"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) handlePickFile(picked);
              }}
            />
            <div className="label text-fg-2 mb-2">Drop or pick a photo</div>
            <div className="label-sm text-fg-3">
              JPEG · PNG · WebP · HEIC · Max 8 MB
            </div>
          </label>
        )}

        {uploadError && (
          <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-err">
            {uploadError}
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Message, photo caption, one-liner…"
          className={`${INPUT_SM} min-h-[72px] leading-[1.5] resize-y`}
        />
        <div className="flex justify-end">
          <Button onClick={handlePost} disabled={!canPost}>
            {uploading ? "Uploading…" : isPosting ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="border border-line py-14 text-center label text-fg-3">
          No messages yet · be the first
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[min(70vh,800px)] overflow-y-auto pr-1"
        >
          {rendered}
        </div>
      )}
    </>
  );
}
