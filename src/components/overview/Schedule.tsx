"use client";

import { useState } from "react";
import { AIDraftBadge } from "@/components/overview/AIDraftBadge";
import { AIDraftRail } from "@/components/overview/AIDraftRail";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { InlineTextarea } from "@/components/ui/InlineTextarea";
import {
  addScheduleRow,
  deleteScheduleRow,
  insertScheduleRow,
  reorderScheduleRow,
  updateScheduleRow,
} from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";
import type { ScheduleItem } from "@/lib/types";

type AiRail = {
  tripId: string;
  destination: string;
  draftedAt: string | null;
  canRedraft: boolean;
  blockedReason: string | null;
};

type Props = {
  rows: ScheduleItem[];
  isAdmin?: boolean;
  tripId: string;
  tripSlug?: string;
  aiDrafted?: boolean;
  aiRail?: AiRail;
};

export function Schedule({
  rows,
  isAdmin,
  tripId,
  aiDrafted = false,
  aiRail,
}: Props) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<ScheduleItem[] | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const displayed = optimistic ?? rows;

  const commitRow = async (
    index: number,
    patch: { day_label?: string; heading?: string; body?: string },
  ): Promise<boolean> => {
    const prev = displayed;
    const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setOptimistic(next);
    const res = await updateScheduleRow({ tripId, index, patch });
    if (res?.error) {
      setOptimistic(prev);
      toast.error(res.error);
      return false;
    }
    setOptimistic(null);
    return true;
  };

  const reorder = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= displayed.length) return;
    const prev = displayed;
    const moved = prev.slice();
    const [row] = moved.splice(from, 1);
    moved.splice(to, 0, row);
    setOptimistic(moved);
    const res = await reorderScheduleRow({ tripId, from, to });
    if (res?.error) {
      setOptimistic(prev);
      toast.error(res.error);
      return;
    }
    setOptimistic(null);
  };

  const addDay = async () => {
    const res = await addScheduleRow(tripId);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
  };

  const removeDay = async (i: number) => {
    const removed = displayed[i];
    const prev = displayed;
    setOptimistic(prev.filter((_, idx) => idx !== i));
    const res = await deleteScheduleRow({ tripId, index: i });
    if (res?.error) {
      setOptimistic(prev);
      toast.error(res.error);
      return;
    }
    setOptimistic(null);
    toast.reversible({
      message: `Removed "${removed.heading || `day ${i + 1}`}"`,
      actionLabel: "Undo",
      duration: 8000,
      onAction: async () => {
        const undo = await insertScheduleRow({
          tripId,
          index: i,
          row: {
            day_label: removed.day_label,
            heading: removed.heading,
            body: removed.body,
          },
        });
        if (undo?.error) toast.error(undo.error);
      },
    });
  };

  const emptyAdmin = displayed.length === 0 && isAdmin;
  const emptyReader = displayed.length === 0 && !isAdmin;

  if (emptyReader) {
    return (
      <div className="border border-line py-14 text-center">
        <div className="label-sm-wide text-fg-3">
          Schedule · details coming soon
        </div>
      </div>
    );
  }

  return (
    <div>
      {aiDrafted && aiRail ? (
        <AIDraftRail
          tripId={aiRail.tripId}
          destination={aiRail.destination}
          surface="schedule"
          draftedAt={aiRail.draftedAt}
          isAdmin={!!isAdmin}
          canRedraft={aiRail.canRedraft}
          blockedReason={aiRail.blockedReason}
        />
      ) : aiDrafted ? (
        <div className="flex justify-end mb-2">
          <AIDraftBadge />
        </div>
      ) : null}

      {emptyAdmin ? (
        <div className="border border-line py-14 text-center">
          <div className="label-sm-wide text-fg-3 mb-4">Schedule empty</div>
          <button
            type="button"
            onClick={addDay}
            className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent hover:text-fg transition-colors cursor-pointer"
          >
            + Add the first day
          </button>
        </div>
      ) : (
        <div className="border border-line">
          {displayed.map((row, i) => {
            const isDragOver = dragOver === i && dragFrom !== null && dragFrom !== i;
            return (
              <div
                key={i}
                draggable={!!isAdmin}
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (dragFrom !== null) {
                    await reorder(dragFrom, i);
                  }
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`group grid ${
                  isAdmin
                    ? "grid-cols-[140px_1fr_auto]"
                    : "grid-cols-[140px_1fr]"
                } max-[520px]:grid-cols-1 border-b border-line last:border-b-0 py-[22px] px-6 gap-5 transition-colors ${
                  isDragOver ? "bg-bg-2" : ""
                }`}
              >
                <div className="pt-[3px] max-[520px]:flex max-[520px]:items-baseline max-[520px]:gap-3">
                  <div
                    className={`font-mono text-[10px] tracking-[0.18em] uppercase text-fg-4 tabular mb-[6px] max-[520px]:mb-0 ${
                      isAdmin ? "cursor-grab active:cursor-grabbing" : ""
                    } select-none`}
                    aria-hidden={!isAdmin}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent">
                    <InlineEdit
                      value={row.day_label}
                      onCommit={(v) => commitRow(i, { day_label: v })}
                      editable={!!isAdmin}
                      as="span"
                      maxLength={30}
                      ariaLabel={`Edit day ${i + 1} label`}
                      emptyLabel="Day"
                      className="inline"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[20px] font-medium tracking-[-0.02em] mb-[6px]">
                    <InlineEdit
                      value={row.heading}
                      onCommit={(v) => commitRow(i, { heading: v })}
                      editable={!!isAdmin}
                      as="span"
                      maxLength={120}
                      ariaLabel={`Edit day ${i + 1} heading`}
                      emptyLabel="Heading"
                      className="inline"
                    />
                  </div>
                  <InlineTextarea
                    value={row.body}
                    onCommit={(v) => commitRow(i, { body: v })}
                    editable={!!isAdmin}
                    maxLength={500}
                    ariaLabel={`Edit day ${i + 1} body`}
                    emptyLabel="Body — two sentences. Name specific venues."
                    className="text-fg-2 text-[14px] leading-[1.55]"
                  />
                </div>
                {isAdmin && (
                  <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-start gap-1 pt-[3px]">
                    <button
                      type="button"
                      onClick={() => reorder(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move day ${i + 1} up`}
                      className="h-7 w-7 flex items-center justify-center font-mono text-[11px] text-fg-3 hover:text-fg disabled:text-fg-4 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => reorder(i, i + 1)}
                      disabled={i === displayed.length - 1}
                      aria-label={`Move day ${i + 1} down`}
                      className="h-7 w-7 flex items-center justify-center font-mono text-[11px] text-fg-3 hover:text-fg disabled:text-fg-4 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDay(i)}
                      aria-label={`Delete day ${i + 1}`}
                      className="h-7 w-7 flex items-center justify-center font-mono text-[11px] text-fg-3 hover:text-err transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {isAdmin && displayed.length < 20 && (
            <button
              type="button"
              onClick={addDay}
              className="w-full py-4 text-center font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 hover:text-accent hover:bg-bg-2 transition-colors cursor-pointer"
            >
              <span aria-hidden>+</span> Add day
            </button>
          )}
        </div>
      )}
    </div>
  );
}
