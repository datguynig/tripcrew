"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleBookingDone } from "@/lib/actions/bookings";
import { BookingPlaceLinks } from "@/components/bookings/BookingPlaceLinks";
import type { Booking } from "@/lib/types";

type Props = {
  initial: Booking[];
  tripSlug: string;
};

export function BookAheadList({ initial, tripSlug }: Props) {
  const [bookings, setBookings] = useState<Booking[]>(initial);
  const [, startTransition] = useTransition();

  useEffect(() => setBookings(initial), [initial]);

  if (bookings.length === 0) return null;

  const sorted = [...bookings].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.position - b.position;
  });
  const doneCount = bookings.filter((b) => b.done).length;

  const handleToggle = (id: string, done: boolean) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, done } : b)),
    );
    startTransition(async () => {
      await toggleBookingDone(id, done);
    });
  };

  return (
    <section className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <div className="label-sm text-fg-3">BOOK AHEAD</div>
          {bookings.length > 0 && (
            <span className="label-sm text-fg-3 tabular-nums">
              {doneCount} / {bookings.length}
            </span>
          )}
        </div>
        <Link
          href={`/trips/${tripSlug}/bookings`}
          className="label-sm text-fg-3 hover:text-accent transition-colors"
        >
          See all →
        </Link>
      </div>
      <ul className="border border-line bg-bg-2 divide-y divide-line">
        {sorted.map((b) => (
          <li
            key={b.id}
            className={`px-5 py-4 grid grid-cols-[28px_1fr_auto] gap-4 items-center max-[520px]:gap-3 transition-opacity ${
              b.done ? "opacity-50" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => handleToggle(b.id, !b.done)}
              aria-label={b.done ? `Mark "${b.title}" not done` : `Mark "${b.title}" done`}
              className={`relative w-5 h-5 rounded border-[1.5px] cursor-pointer transition-colors ${
                b.done
                  ? "bg-accent border-accent after:content-[''] after:absolute after:left-[5px] after:top-[1px] after:w-[6px] after:h-[11px] after:border-solid after:border-bg after:border-r-[2px] after:border-b-[2px] after:rotate-45"
                  : "bg-transparent border-fg-3 hover:border-fg"
              }`}
            />
            <div
              className={`min-w-0 text-[15px] font-medium text-fg leading-[1.3] ${
                b.done ? "line-through text-fg-3" : ""
              }`}
            >
              {b.title}
            </div>
            <BookingPlaceLinks booking={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}
