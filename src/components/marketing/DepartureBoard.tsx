"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SAMPLE_TRIPS, type SampleTrip } from "@/lib/marketing/sampleTrips";

const ROTATE_INTERVAL_MS = 5500;

type FlipKey = "iata" | "datesLabel" | "perHead" | "vibesLabel";

const FLIP_FIELDS: { key: FlipKey; label: string }[] = [
  { key: "iata", label: "Destination" },
  { key: "datesLabel", label: "Dates" },
  { key: "perHead", label: "Per head" },
  { key: "vibesLabel", label: "Vibes" },
];

function fieldValue(trip: SampleTrip, key: FlipKey): string {
  if (key === "iata") return trip.iata;
  if (key === "datesLabel") return trip.datesLabel;
  if (key === "vibesLabel") return trip.vibesLabel;
  return `£${trip.perHeadAmount.toLocaleString("en-GB")}`;
}

export function DepartureBoard({ initialIndex = 0 }: { initialIndex?: number }) {
  const trips = SAMPLE_TRIPS;
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
      id="sample-trips"
      aria-roledescription="carousel"
      aria-label="Sample trips by Tripcrew"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative w-full bg-ink text-cream focus:outline-none"
    >
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral mb-3">
              Sample trips · live board
            </p>
            <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[60px] leading-[1.02] tracking-[-0.025em] max-w-[18ch]">
              Five trips. Plotted by AI.<br />
              <span className="text-cream/60">Locked in by real crews.</span>
            </h2>
          </div>
        </div>

        <article className="relative w-full aspect-[16/10] md:aspect-[16/9] overflow-hidden border-2 border-cream/15">
          <BoardBackground trip={trip} reduceMotion={reduceMotion} />

          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <BoardCue index={index} total={trips.length} />
              <FlipRow trip={trip} reduceMotion={reduceMotion} />
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              <div className="flex flex-col gap-3 max-w-[36ch]">
                <h3 className="font-serif text-[44px] sm:text-[64px] lg:text-[88px] leading-[0.95] tracking-[-0.035em] text-cream">
                  {trip.city}
                </h3>
                <div className="h-[2px] w-12 bg-marketing-coral" />
                <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream/85">
                  {trip.occasionLine}
                </p>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {trip.highlights.map((h) => (
                    <li
                      key={h}
                      className="border border-cream/30 bg-ink/40 px-3 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] text-cream/85"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/sample-trip/${trip.slug}`}
                className="self-start sm:self-end inline-flex items-center justify-center bg-cream text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-6 border-2 border-cream hover:bg-transparent hover:text-cream transition-colors duration-150"
              >
                Explore the full trip →
              </Link>
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
  trip: SampleTrip;
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
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/65 via-transparent to-transparent" />
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
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/85">
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
  trip: SampleTrip;
  reduceMotion: boolean;
}) {
  return (
    <dl
      aria-live="polite"
      className="hidden sm:grid grid-cols-4 gap-2 max-w-[640px] w-full"
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
    <div className="bg-ink/85 border border-cream/25 px-3 py-3 backdrop-blur-sm">
      <dt className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/55 mb-1.5">
        {label}
      </dt>
      <dd
        style={{ animationDelay: `${delayMs}ms` }}
        className={
          "font-serif text-[18px] sm:text-[22px] leading-none tracking-[-0.01em] text-cream " +
          (reduceMotion ? "" : "motion-safe:animate-tc-flip origin-top")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function PhotoCredit({ trip }: { trip: SampleTrip }) {
  return (
    <p className="mt-4 font-mono uppercase tracking-[0.18em] text-[9px] text-cream/40">
      Photo ·{" "}
      <a
        href={trip.heroPhotoCredit.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-4 hover:text-cream/70 hover:underline"
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
  trips: readonly SampleTrip[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ul className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3" role="tablist">
      {trips.map((entry, index) => {
        const active = index === activeIndex;
        return (
          <li key={entry.slug}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Show ${entry.city}`}
              onClick={() => onSelect(index)}
              className={
                "group relative w-full aspect-[4/3] overflow-hidden border-2 transition-colors duration-150 " +
                (active
                  ? "border-marketing-coral"
                  : "border-cream/15 hover:border-cream/40")
              }
            >
              <Image
                src={entry.heroPhotoUrl}
                alt={entry.city}
                fill
                sizes="(min-width: 640px) 240px, 50vw"
                className={
                  "object-cover transition-opacity duration-150 " +
                  (active ? "opacity-100" : "opacity-60 group-hover:opacity-90")
                }
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between">
                <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream">
                  {entry.iata}
                </span>
                <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/70">
                  {entry.city}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
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
