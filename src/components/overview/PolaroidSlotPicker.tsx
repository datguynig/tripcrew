"use client";

import { useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadTripHeroImage } from "@/lib/uploadTripHero";
import { setPolaroidSlot } from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";

export type PickerActivity = {
  id: string;
  title: string;
  photo_url: string;
  photo_attribution: string | null;
};

export type PickerPost = {
  id: string;
  image_url: string;
  caption: string | null;
  author_id: string;
  created_at: string;
};

type Tab = "upload" | "activities" | "gallery";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  slotIndex: number;
  activities: PickerActivity[];
  posts: PickerPost[];
  authorNameById: Record<string, string>;
  hasOverride: boolean;
};

export function PolaroidSlotPicker({
  open,
  onOpenChange,
  tripId,
  slotIndex,
  activities,
  posts,
  authorNameById,
  hasOverride,
}: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();

  const close = () => onOpenChange(false);

  const commit = (
    override: Parameters<typeof setPolaroidSlot>[0]["override"],
  ) => {
    startSave(async () => {
      const res = await setPolaroidSlot({
        tripId,
        index: slotIndex,
        override,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(override ? "Polaroid updated." : "Back to auto.");
      close();
    });
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    const uploaded = await uploadTripHeroImage(file);
    setUploading(false);
    if (!uploaded.ok) {
      toast.error(uploaded.message);
      return;
    }
    commit({
      imageUrl: uploaded.url,
      caption: null,
      subcaption: null,
      sourceType: "upload",
      sourceId: null,
    });
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleUploadFile(file);
  };

  const pickActivity = (a: PickerActivity) => {
    commit({
      imageUrl: a.photo_url,
      caption: a.title,
      subcaption: a.photo_attribution ? `PHOTO · ${a.photo_attribution.toUpperCase()}` : null,
      sourceType: "activity",
      sourceId: a.id,
    });
  };

  const pickPost = (p: PickerPost) => {
    const name = authorNameById[p.author_id] ?? "CREW";
    commit({
      imageUrl: p.image_url,
      caption: name,
      subcaption: p.caption ? truncate(p.caption, 40) : null,
      sourceType: "post",
      sourceId: p.id,
    });
  };

  const handleReset = () => commit(null);

  const busy = uploading || saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(640px,calc(100vw-32px))] !p-0">
        <div className="p-6 border-b border-line">
          <DialogTitle>Swap this polaroid</DialogTitle>
          <div className="flex gap-1 mt-5">
            <TabBtn active={tab === "upload"} onClick={() => setTab("upload")}>
              Upload
            </TabBtn>
            <TabBtn
              active={tab === "activities"}
              onClick={() => setTab("activities")}
              disabled={activities.length === 0}
            >
              Activities
            </TabBtn>
            <TabBtn
              active={tab === "gallery"}
              onClick={() => setTab("gallery")}
              disabled={posts.length === 0}
            >
              Gallery
            </TabBtn>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {tab === "upload" && (
            <div className="flex flex-col items-start gap-4">
              <div className="text-[13px] text-fg-2 leading-[1.5]">
                Upload an image from your device. JPEG, PNG, WebP, or HEIC, up
                to 8 MB.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {uploading ? "Uploading…" : "Choose file"}
              </Button>
            </div>
          )}

          {tab === "activities" && (
            <div className="grid grid-cols-3 max-[520px]:grid-cols-2 gap-3">
              {activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickActivity(a)}
                  disabled={busy}
                  aria-label={`Use ${a.title} photo`}
                  className="relative aspect-[4/5] overflow-hidden border border-line hover:border-line-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait group/tile"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.photo_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent px-2 py-2">
                    <div className="label-xs text-fg tracking-[0.12em] truncate">
                      {a.title}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "gallery" && (
            <div className="grid grid-cols-3 max-[520px]:grid-cols-2 gap-3">
              {posts.map((p) => {
                const name = authorNameById[p.author_id] ?? "Crew";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPost(p)}
                    disabled={busy}
                    aria-label={`Use ${name}'s photo`}
                    className="relative aspect-[4/5] overflow-hidden border border-line hover:border-line-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent px-2 py-2">
                      <div className="label-xs text-fg tracking-[0.12em] truncate">
                        {name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-line">
          {hasOverride ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              className="label-xs tracking-[0.14em] text-fg-3 hover:text-fg cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              RESET TO AUTO
            </button>
          ) : (
            <span />
          )}
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={`label-xs tracking-[0.14em] px-3 py-[6px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-accent text-fg bg-accent/[0.08]"
          : "border-line text-fg-2 hover:border-line-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
