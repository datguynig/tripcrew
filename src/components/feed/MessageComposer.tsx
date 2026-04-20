"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT_SM } from "@/lib/styles";
import { uploadPostImage } from "@/lib/uploadImage";

export type ReplyTarget = {
  postId: string;
  authorName: string;
  excerpt: string;
};

type Props = {
  sending: boolean;
  replyTarget: ReplyTarget | null;
  onClearReply: () => void;
  onSend: (input: { imageUrl: string | null; caption: string | null }) => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageComposer({
  sending,
  replyTarget,
  onClearReply,
  onSend,
}: Props) {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Auto-grow the textarea as the caption gains lines.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [caption]);

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

  const canSend =
    !uploading &&
    !sending &&
    ((uploadedUrl !== null && !uploadError) ||
      caption.trim().length > 0 ||
      replyTarget !== null);

  const handleSend = () => {
    if (!canSend) return;
    const trimmed = caption.trim();
    const imageUrl = uploadedUrl;
    setCaption("");
    clearFile();
    onSend({ imageUrl, caption: trimmed || null });
  };

  const sendLabel = uploading ? "Uploading…" : sending ? "Sending…" : "Send";

  return (
    <div className="border-t border-line bg-bg/90 backdrop-blur-md px-5 py-4">
      <div className="flex flex-col gap-3">
        {(replyTarget || file) && (
          <div className="flex flex-col gap-2">
            {replyTarget && (
              <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-bg-2 px-3 py-[10px]">
                <div className="flex-1 min-w-0">
                  <div className="label-xs text-fg-3 mb-[2px]">
                    Replying to {replyTarget.authorName}
                  </div>
                  <div className="text-[13px] text-fg-2 truncate">
                    {replyTarget.excerpt}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearReply}
                  aria-label="Cancel reply"
                  className="h-6 w-6 flex items-center justify-center text-fg-3 hover:text-fg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
            {file && previewUrl && (
              <div className="flex items-center gap-3 border border-line bg-bg-2 p-[10px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt=""
                  className={`w-14 h-[42px] object-cover bg-bg-3 transition-opacity ${
                    uploading ? "opacity-50" : ""
                  }`}
                />
                <div className="flex-1 min-w-0">
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
                  className="h-6 w-6 flex items-center justify-center text-fg-3 hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-err">
            {uploadError}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            replyTarget ? "Write a reply…" : "Message the crew…"
          }
          rows={1}
          className={`${INPUT_SM} min-h-[44px] max-h-[180px] leading-[1.5] resize-none overflow-y-auto`}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center cursor-pointer label text-fg-3 hover:text-fg focus-within:text-fg transition-colors">
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
            Add photo
          </label>
          <Button onClick={handleSend} disabled={!canSend}>
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
