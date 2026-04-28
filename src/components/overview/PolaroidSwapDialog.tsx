"use client";

import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { setPolaroidSlot } from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";
import type { PolaroidSlot } from "@/components/overview/PolaroidStack";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  slotIndex: number;
  slots: PolaroidSlot[];
};

export function PolaroidSwapDialog({
  open,
  onOpenChange,
  tripId,
  slotIndex,
  slots,
}: Props) {
  const toast = useToast();
  const [saving, startSave] = useTransition();

  const close = () => onOpenChange(false);

  const others = slots
    .map((s, i) => ({ slot: s, index: i }))
    .filter((x) => x.index !== slotIndex);

  const handlePick = (other: { slot: PolaroidSlot; index: number }) => {
    const source = slots[slotIndex];
    if (!source) return;
    const a = source;
    const b = other.slot;
    startSave(async () => {
      const resA = await setPolaroidSlot({
        tripId,
        index: slotIndex,
        override: {
          imageUrl: b.imageUrl,
          caption: b.caption,
          subcaption: b.subcaption ?? null,
          sourceType: b.sourceType,
          sourceId: b.sourceId ?? null,
        },
      });
      if (resA?.error) {
        toast.error(resA.error);
        return;
      }
      const resB = await setPolaroidSlot({
        tripId,
        index: other.index,
        override: {
          imageUrl: a.imageUrl,
          caption: a.caption,
          subcaption: a.subcaption ?? null,
          sourceType: a.sourceType,
          sourceId: a.sourceId ?? null,
        },
      });
      if (resB?.error) {
        toast.error(resB.error);
        return;
      }
      toast.success(`Swapped slots ${slotIndex + 1} ↔ ${other.index + 1}.`);
      close();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(520px,calc(100vw-32px))]">
        <DialogTitle>Reorder slot {slotIndex + 1}</DialogTitle>
        <DialogDescription>
          Pick the slot to swap this polaroid with. Both stay in the stack. They just trade positions.
        </DialogDescription>

        <div className="grid grid-cols-4 max-[520px]:grid-cols-2 gap-3">
          {others.map((other) => (
            <button
              key={other.index}
              type="button"
              onClick={() => handlePick(other)}
              disabled={saving}
              aria-label={`Swap with slot ${other.index + 1}`}
              className="relative aspect-[4/5] overflow-hidden border border-line hover:border-line-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={other.slot.imageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-[6px] left-[6px] bg-bg/80 backdrop-blur-sm label-xs tracking-[0.14em] text-fg px-[6px] py-[2px] tabular">
                {other.index + 1}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent px-2 py-2">
                <div className="label-xs text-fg tracking-[0.12em] truncate">
                  {other.slot.caption}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
