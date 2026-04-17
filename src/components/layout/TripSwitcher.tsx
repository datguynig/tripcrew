"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Trip, TripRole } from "@/lib/types";

type SwitcherTrip = Trip & { role: TripRole };

type Props = {
  trips: SwitcherTrip[];
};

type Bucket = "active" | "planning" | "past";

function bucketFor(trip: SwitcherTrip, todayIso: string): Bucket {
  if (trip.status === "planning") return "planning";
  if (trip.end_date && trip.end_date < todayIso) return "past";
  return "active";
}

function matchSlugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/trips\/([^/]+)/);
  if (!m) return null;
  const slug = m[1];
  if (slug === "new") return null;
  return slug;
}

export function TripSwitcher({ trips }: Props) {
  const pathname = usePathname();
  const currentSlug = matchSlugFromPath(pathname);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = trips.find((t) => t.slug === currentSlug) ?? null;

  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const grouped = useMemo(() => {
    const g: Record<Bucket, SwitcherTrip[]> = {
      active: [],
      planning: [],
      past: [],
    };
    for (const t of trips) g[bucketFor(t, today)].push(t);
    return g;
  }, [trips, today]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = current?.name ?? "TripCrew";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-[10px] font-mono text-[11px] tracking-[0.18em] uppercase text-fg hover:text-fg-2 transition-colors cursor-pointer"
      >
        <span className="w-[7px] h-[7px] bg-accent rounded-full brand-dot" />
        <span className="truncate max-w-[280px]">{label}</span>
        <svg
          aria-hidden
          viewBox="0 0 10 10"
          className={`w-[10px] h-[10px] text-fg-2 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5 L5 6.5 L8 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+10px)] z-50 min-w-[320px] max-w-[420px] bg-bg-2 border border-line rounded-md shadow-lg py-2"
        >
          {trips.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-fg-2">
              No trips yet.
            </div>
          )}

          <GroupList
            label="Active"
            rows={grouped.active}
            currentSlug={currentSlug}
          />
          <GroupList
            label="Planning"
            rows={grouped.planning}
            currentSlug={currentSlug}
          />
          <GroupList
            label="Past"
            rows={grouped.past}
            currentSlug={currentSlug}
          />

          <div className="border-t border-line mt-1 pt-1">
            <Link
              href="/trips/new"
              role="menuitem"
              className="flex items-center gap-3 px-4 py-[10px] text-[13px] text-accent hover:bg-bg-3 transition-colors"
            >
              <span className="font-mono text-[11px] tracking-[0.15em] uppercase">
                + Create trip
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupList({
  label,
  rows,
  currentSlug,
}: {
  label: string;
  rows: SwitcherTrip[];
  currentSlug: string | null;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="pb-1 last:pb-0">
      <Badge tone="muted" size="sm" className="block px-4 pt-2 pb-1">
        {label}
      </Badge>
      {rows.map((trip) => {
        const isCurrent = trip.slug === currentSlug;
        const subtitle =
          trip.destination ??
          (trip.status === "planning" ? "Planning" : "No destination");
        return (
          <Link
            key={trip.id}
            href={`/trips/${trip.slug}`}
            role="menuitem"
            className={`flex items-center gap-3 px-4 py-[10px] hover:bg-bg-3 transition-colors ${
              isCurrent ? "bg-bg-3" : ""
            }`}
          >
            <span
              className={`w-[6px] h-[6px] rounded-full shrink-0 ${
                isCurrent ? "bg-accent" : "bg-line-2"
              }`}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium tracking-[-0.01em] truncate">
                {trip.name}
              </span>
              <span className="block font-mono text-[10px] tracking-[0.08em] uppercase text-fg-3 truncate">
                {subtitle}
              </span>
            </span>
            {trip.role === "admin" && (
              <Badge tone="muted" size="sm" className="shrink-0">
                Admin
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
