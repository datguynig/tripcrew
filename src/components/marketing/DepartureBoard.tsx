"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CURATED_TRIPS, type CuratedTrip } from "@/lib/marketing/curatedTrips";

const ROTATE_INTERVAL_MS = 5500;

type FlipKey = "destination" | "datesLabel" | "perHead" | "vibesLabel";

const FLIP_FIELDS: { key: FlipKey; label: string }[] = [
  { key: "destination", label: "Destination" },
  { key: "datesLabel", label: "Dates" },
  { key: "perHead", label: "Per head" },
  { key: "vibesLabel", label: "Vibes" },
];

function fieldValue(trip: CuratedTrip, key: FlipKey): string {
  if (key === "destination") return `${trip.city}, ${trip.country}`;
  if (key === "datesLabel") return trip.datesLabel;
  if (key === "vibesLabel") return trip.vibesLabel;
  return `£${trip.perHeadAmount.toLocaleString("en-GB")}`;
}

export function DepartureBoard({ initialIndex = 0 }: { initialIndex?: number }) {
  const trips = CURATED_TRIPS;
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(true);

  const trip = trips[index]!;

  useEffect(() => {
    if (!sectionRef.current) return;
    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (!visibleRef.current) return;
      setIndex((prev) => (prev + 1) % trips.length);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, trips.length]);

  const handleSelect = useCallback(
    (next: number) => {
      const safe = ((next % trips.length) + trips.length) % trips.length;
      setIndex(safe);
    },
    [trips.length],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleSelect(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleSelect(index - 1);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="curated-trips"
      aria-roledescription="carousel"
      aria-label="Five curated starter trips by Tripcrew"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative w-full bg-ink text-cream focus:outline-none"
    >
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 py-24 md:py-32">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral mb-3">
              Curated by us · five starter trips
            </p>
            <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[60px] leading-[1.02] tracking-[-0.025em] max-w-[20ch]">
              The first five trips, hand-picked for the founding crews.
            </h2>
            <p className="mt-5 text-[16px] md:text-[17px] leading-[1.55] text-cream/70 max-w-[58ch]">
              Apply once and the AI plans any of them, scaled to your budget,
              your dates, your crew. Vibes change. Schedule changes. The plan is
              yours, not a template.
            </p>
          </div>
        </div>

        <article className="relative w-full aspect-[16/10] md:aspect-[16/9] overflow-hidden border-2 border-cream/15">
          <BoardBackground trip={trip} reduceMotion={reduceMotion} />

          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <BoardCue index={index} total={trips.length} />
              <FlipRow trip={trip} reduceMotion={reduceMotion} />
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
              <div className="flex flex-col gap-3 max-w-[40ch]">
                <h3 className="font-serif text-[44px] sm:text-[64px] lg:text-[88px] leading-[0.92] tracking-[-0.035em] text-cream">
                  {trip.city}
                </h3>
                <div className="h-[2px] w-12 bg-marketing-coral" />
                <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream">
                  {trip.country} · {trip.totalDays} days · {trip.crewLabel}
                </p>
                <p className="text-[15px] sm:text-[16px] leading-[1.5] text-cream/85 italic font-serif max-w-[44ch]">
                  {trip.curatorPick}
                </p>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {trip.highlights.map((h) => (
                    <li
                      key={h}
                      className="border border-cream/40 bg-ink/55 px-3 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] text-cream"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <Link
                  href={`/apply?intent=plus&seed=${trip.slug}&vibes=${trip.applyVibes}`}
                  className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-6 border-2 border-marketing-coral hover:bg-cream hover:text-ink hover:border-cream transition-colors duration-150 whitespace-nowrap"
                >
                  Plan my {trip.city} trip →
                </Link>
                <Link
                  href={`/curated/${trip.slug}`}
                  className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/65 hover:text-cream underline-offset-4 hover:underline"
                >
                  Or browse the full plan
                </Link>
              </div>
            </div>
          </div>
        </article>

        <PhotoCredit trip={trip} />

        <ThumbStrip
          trips={trips}
          activeIndex={index}
          onSelect={handleSelect}
        />
      </div>
    </section>
  );
}

function BoardBackground({
  trip,
  reduceMotion,
}: {
  trip: CuratedTrip;
  reduceMotion: boolean;
}) {
  return (
    <>
      <div
        key={trip.slug}
        className={
          reduceMotion
            ? "absolute inset-0"
            : "absolute inset-0 motion-safe:animate-tc-fade"
        }
      >
        <Image
          src={trip.heroPhotoUrl}
          alt=""
          fill
          sizes="(min-width: 1440px) 1400px, 100vw"
          className="object-cover"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/15 to-transparent" />
    </>
  );
}

function BoardCue({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="w-[10px] h-[10px] bg-marketing-coral animate-pulse"
      />
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream">
        Now boarding · {String(index + 1).padStart(2, "0")} of{" "}
        {String(total).padStart(2, "0")}
      </p>
    </div>
  );
}

function FlipRow({
  trip,
  reduceMotion,
}: {
  trip: CuratedTrip;
  reduceMotion: boolean;
}) {
  return (
    <dl
      aria-live="polite"
      className="hidden md:grid grid-cols-4 gap-2 max-w-[680px] w-full"
    >
      {FLIP_FIELDS.map((field, i) => (
        <FlipTile
          key={`${field.key}-${trip.slug}`}
          label={field.label}
          value={fieldValue(trip, field.key)}
          delayMs={reduceMotion ? 0 : i * 110}
          reduceMotion={reduceMotion}
        />
      ))}
    </dl>
  );
}

function FlipTile({
  label,
  value,
  delayMs,
  reduceMotion,
}: {
  label: string;
  value: string;
  delayMs: number;
  reduceMotion: boolean;
}) {
  return (
    <div className="bg-ink/85 border border-cream/30 px-3 py-3 backdrop-blur-sm">
      <dt className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/70 mb-1.5">
        {label}
      </dt>
      <dd
        style={{ animationDelay: `${delayMs}ms` }}
        className={
          "font-serif text-[15px] lg:text-[17px] leading-[1.15] tracking-[-0.005em] text-cream truncate " +
          (reduceMotion ? "" : "motion-safe:animate-tc-flip origin-top")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function PhotoCredit({ trip }: { trip: CuratedTrip }) {
  return (
    <p className="mt-4 font-mono uppercase tracking-[0.18em] text-[9px] text-cream/70">
      Photo ·{" "}
      <a
        href={trip.heroPhotoCredit.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-4 hover:text-cream/80 hover:underline"
      >
        {trip.heroPhotoCredit.name} on Unsplash
      </a>
    </p>
  );
}

function ThumbStrip({
  trips,
  activeIndex,
  onSelect,
}: {
  trips: readonly CuratedTrip[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3"
      role="tablist"
      aria-label="Curated trips"
    >
      {trips.map((entry, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={entry.slug}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Show ${entry.city}, ${entry.country}`}
            onClick={() => onSelect(index)}
            className={
              "group relative w-full aspect-[4/3] overflow-hidden border-2 transition-colors duration-150 " +
              (active
                ? "border-marketing-coral"
                : "border-cream/15 hover:border-cream/45")
            }
          >
            <Image
              src={entry.heroPhotoUrl}
              alt={`${entry.city}, ${entry.country}`}
              fill
              sizes="(min-width: 640px) 240px, 50vw"
              className={
                "object-cover transition-opacity duration-150 " +
                (active ? "opacity-100" : "opacity-65 group-hover:opacity-90")
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex flex-col gap-0.5 text-left">
              <span className="font-serif text-[16px] leading-none tracking-[-0.01em] text-cream">
                {entry.city}
              </span>
              <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/85">
                {entry.country}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const handler = (event: MediaQueryListEvent) => setReduce(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduce;
}
