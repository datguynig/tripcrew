"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import {
  listDraftVersions,
  restoreDraftVersion,
} from "@/lib/actions/aiDraft";
import type { DraftSurface } from "@/lib/ai";

type Version = { id: string; createdAt: string; preview: string };

type Props = {
  tripId: string;
  surface: DraftSurface;
  onClose: () => void;
};

export function AIDraftHistory({ tripId, surface, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listDraftVersions({ tripId, surface }).then((res) => {
      setVersions(res.versions ?? []);
      setLoading(false);
    });
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [tripId, surface, onClose]);

  const handleRestore = (versionId: string) => {
    if (pending) return;
    startTransition(async () => {
      const res = await restoreDraftVersion({ versionId });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Restored previous version.");
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Previous drafts"
      className="absolute right-0 top-[calc(100%+8px)] z-40 w-[380px] max-w-[calc(100vw-2rem)] bg-bg-2 border border-line rounded-md shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 h-10 border-b border-line">
        <div className="label-sm-wide text-fg-3">Previous drafts</div>
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-fg-3 tabular">
          {versions.length} / 3
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2">
          <span
            className="w-[5px] h-[5px] rounded-full bg-accent animate-pulse"
            aria-hidden
          />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3">
            Loading
          </span>
        </div>
      ) : versions.length === 0 ? (
        <div className="py-10 text-center font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3">
          No earlier drafts
        </div>
      ) : (
        <div>
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleRestore(v.id)}
              disabled={pending}
              className="w-full text-left px-5 py-4 border-b border-line last:border-b-0 hover:bg-bg-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-accent tabular">
                  {formatWhen(v.createdAt)}
                </span>
                <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-fg-3">
                  restore →
                </span>
              </div>
              {v.preview && (
                <div className="text-[13px] text-fg-2 line-clamp-2 leading-[1.45]">
                  {v.preview}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
