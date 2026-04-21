"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PolaroidSlot } from "@/components/overview/PolaroidStack";

type Props = {
  slots: PolaroidSlot[];
  currentIndex: number;
  onClose: () => void;
};

const SWIPE_THRESHOLD = 40;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function PolaroidLightbox({ slots, currentIndex, onClose }: Props) {
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(currentIndex, slots.length - 1)),
  );
  const [imageBroken, setImageBroken] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const slot = slots[index];
  const hasPrev = index > 0;
  const hasNext = index < slots.length - 1;

  useEffect(() => {
    setImageBroken(false);
    setImageLoaded(false);
  }, [slot?.imageUrl]);

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
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );
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

  if (!slot || typeof document === "undefined") return null;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0 && hasNext) setIndex((i) => i + 1);
      else if (dx > 0 && hasPrev) setIndex((i) => i - 1);
    } else if (dy > SWIPE_THRESHOLD * 1.5) {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="polaroid-lightbox-title"
      onClick={onClose}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="fixed inset-0 z-[100] bg-bg/95 backdrop-blur-md flex flex-col"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex-1 flex items-center justify-center min-h-0 group/img px-6 pt-6 pb-4"
      >
        {!imageBroken ? (
          <>
            {!imageLoaded && (
              <div
                role="status"
                aria-label="Loading photo"
                className="absolute inset-0 flex items-center justify-center label text-fg-3"
              >
                <span className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.imageUrl}
              alt={slot.alt}
              draggable={false}
              className={`max-w-full max-h-full object-contain select-none transition-opacity duration-200 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageBroken(true)}
            />
          </>
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

      <div
        onClick={(e) => e.stopPropagation()}
        className="px-6 pb-6 pt-2 text-center"
      >
        <div
          id="polaroid-lightbox-title"
          className="label text-fg tracking-[0.14em]"
        >
          {slot.caption}
        </div>
        {slot.subcaption && (
          <div className="font-mono text-[10px] tracking-[0.12em] text-fg-3 mt-1">
            {slot.subcaption}
          </div>
        )}
        {slots.length > 1 && (
          <div className="font-mono text-[10px] tracking-[0.12em] text-fg-4 mt-3 tabular">
            {index + 1} / {slots.length}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
