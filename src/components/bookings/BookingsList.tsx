"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addBooking,
  deleteBooking,
  setBookingAssignee,
  toggleBookingDone,
} from "@/lib/actions/bookings";
import type { Booking } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { INPUT_SM } from "@/lib/styles";
import { AIDraftBadge } from "@/components/overview/AIDraftBadge";

type CrewOption = { id: string; name: string };

type Props = {
  initial: Booking[];
  crew: CrewOption[];
  tripId: string;
};

export function BookingsList({ initial, crew, tripId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>(initial);
  const [title, setTitle] = useState("");
  const [, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => setBookings(initial), [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rt:bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setBookings((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Booking;
              if (prev.some((b) => b.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Booking;
              return prev
                .map((b) => (b.id === row.id ? row : b))
                .sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((b) => b.id !== row.id);
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

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("title", trimmed);
    setTitle("");
    startTransition(async () => {
      await addBooking(tripId, fd);
    });
  };

  const handleToggle = (id: string, done: boolean) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, done } : b)),
    );
    startTransition(async () => {
      await toggleBookingDone(id, done);
    });
  };

  const handleAssign = (id: string, assigneeId: string | null) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, assignee_id: assigneeId } : b)),
    );
    startTransition(async () => {
      await setBookingAssignee(id, assigneeId);
    });
  };

  const handleDelete = (id: string) => {
    const removed = bookings.find((b) => b.id === id);
    if (!removed) return;
    setBookings((prev) => prev.filter((b) => b.id !== id));
    toast.undo({
      message: `Deleted "${removed.title}"`,
      duration: 5000,
      onUndo: () => {
        setBookings((prev) =>
          [...prev, removed].sort((a, b) => a.position - b.position),
        );
      },
      onCommit: () => {
        startTransition(async () => {
          await deleteBooking(id);
        });
      },
    });
  };

  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a booking..."
          className={INPUT_SM}
        />
        <Button onClick={handleAdd}>Add</Button>
      </div>

      {bookings.length === 0 ? (
        <div className="border border-line py-14 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          Nothing to book yet
        </div>
      ) : (
        <div className="border border-line">
          {bookings.map((b) => (
            <div
              key={b.id}
              className={`grid grid-cols-[28px_1fr_180px_36px] max-[640px]:grid-cols-[28px_1fr_36px] items-center py-4 px-6 border-b border-line last:border-b-0 gap-4 ${
                b.done ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() => handleToggle(b.id, !b.done)}
                aria-label={b.done ? "Mark not done" : "Mark done"}
                className={`relative w-5 h-5 rounded border-[1.5px] cursor-pointer transition-colors ${
                  b.done
                    ? "bg-accent border-accent after:content-[''] after:absolute after:left-[5px] after:top-[1px] after:w-[6px] after:h-[11px] after:border-solid after:border-bg after:border-r-[2px] after:border-b-[2px] after:rotate-45"
                    : "bg-transparent border-fg-3 hover:border-fg"
                }`}
              />
              <div
                className={`text-[15px] font-medium tracking-[-0.01em] flex items-center gap-2 flex-wrap ${
                  b.done ? "line-through" : ""
                }`}
              >
                <span>{b.title}</span>
                {b.ai_drafted && <AIDraftBadge dot />}
              </div>
              <select
                value={b.assignee_id ?? ""}
                onChange={(e) => handleAssign(b.id, e.target.value || null)}
                className="max-[640px]:hidden bg-bg-2 border border-line text-fg px-3 py-2 text-[11px] rounded-md cursor-pointer font-mono tracking-[0.05em] uppercase w-full hover:border-line-2 focus:outline focus:outline-1 focus:outline-accent focus:-outline-offset-1"
              >
                <option value="">Unassigned</option>
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                variant="icon"
                onClick={() => handleDelete(b.id)}
                aria-label="Delete booking"
                className="hover:text-err"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
