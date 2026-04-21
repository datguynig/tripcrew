"use client";

import { useState } from "react";
import { Polaroid } from "@/components/overview/Polaroid";
import { PolaroidLightbox } from "@/components/overview/PolaroidLightbox";
import {
  PolaroidSlotPicker,
  type PickerActivity,
  type PickerPost,
} from "@/components/overview/PolaroidSlotPicker";
import { PolaroidSwapDialog } from "@/components/overview/PolaroidSwapDialog";
import type { PolaroidSourceType } from "@/lib/types";

export type PolaroidSlot = {
  imageUrl: string;
  alt: string;
  caption: string;
  subcaption?: string | null;
  sourceType: PolaroidSourceType;
  sourceId?: string | null;
};

type PolaroidStackProps = {
  slots: PolaroidSlot[];
  isAdmin: boolean;
  tripId?: string;
  pickerActivities?: PickerActivity[];
  pickerPosts?: PickerPost[];
  authorNameById?: Record<string, string>;
  overrideIndices?: number[];
};

const STACK_LAYOUT = [
  { tilt: -3, offsetX: -40, offsetY: -20, zIndex: 10 },
  { tilt: 4, offsetX: 60, offsetY: -10, zIndex: 20 },
  { tilt: -5, offsetX: -70, offsetY: 40, zIndex: 30 },
  { tilt: 2, offsetX: 30, offsetY: 60, zIndex: 40 },
  { tilt: -2, offsetX: -10, offsetY: 90, zIndex: 50 },
] as const;

export function PolaroidStack({
  slots,
  isAdmin,
  tripId,
  pickerActivities,
  pickerPosts,
  authorNameById,
  overrideIndices,
}: PolaroidStackProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [reorderIndex, setReorderIndex] = useState<number | null>(null);
  if (slots.length === 0) return null;
  const visible = slots.slice(0, STACK_LAYOUT.length);
  const canEdit =
    isAdmin &&
    !!tripId &&
    !!pickerActivities &&
    !!pickerPosts &&
    !!authorNameById;
  const canReorder = canEdit && visible.length > 1;
  return (
    <>
      <div className="relative w-full h-[520px] max-[900px]:h-[400px] drop-shadow-[0_30px_40px_rgba(0,0,0,0.4)]">
        {visible.map((slot, i) => {
          const pos = STACK_LAYOUT[i];
          return (
            <Polaroid
              key={`${slot.sourceType}-${slot.sourceId ?? i}`}
              imageUrl={slot.imageUrl}
              alt={slot.alt}
              caption={slot.caption}
              subcaption={slot.subcaption}
              tilt={pos.tilt}
              offsetX={pos.offsetX}
              offsetY={pos.offsetY}
              zIndex={pos.zIndex}
              onOpenClick={() => setLightboxIndex(i)}
              onSwapClick={canEdit ? () => setPickerIndex(i) : undefined}
              onReorderClick={
                canReorder ? () => setReorderIndex(i) : undefined
              }
            />
          );
        })}
      </div>
      {lightboxIndex !== null && (
        <PolaroidLightbox
          slots={visible}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      {canEdit && pickerIndex !== null && (
        <PolaroidSlotPicker
          open
          onOpenChange={(next) => {
            if (!next) setPickerIndex(null);
          }}
          tripId={tripId!}
          slotIndex={pickerIndex}
          activities={pickerActivities!}
          posts={pickerPosts!}
          authorNameById={authorNameById!}
          hasOverride={(overrideIndices ?? []).includes(pickerIndex)}
        />
      )}
      {canReorder && reorderIndex !== null && (
        <PolaroidSwapDialog
          open
          onOpenChange={(next) => {
            if (!next) setReorderIndex(null);
          }}
          tripId={tripId!}
          slotIndex={reorderIndex}
          slots={visible}
        />
      )}
    </>
  );
}

