"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  m,
  useMotionValue,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { PanInfo } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { CURATED_TRIPS, type CuratedTrip } from "@/lib/marketing/curatedTrips";
import { duration, easeOutExpo, usePrefersReducedMotion } from "@/lib/motion";

function useClientReducedMotion(): boolean {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted && Boolean(prefersReducedMotion);
}

function useViewportParallaxY(
  ref: RefObject<HTMLElement | null>,
  disabled: boolean,
  distance = -40,
): MotionValue<number> {
  const y = useMotionValue(0);

  useEffect(() => {
    if (disabled) {
      y.set(0);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = Math.min(
        1,
        Math.max(0, (viewport - rect.top) / (viewport + rect.height)),
      );
      y.set(progress * distance);
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [disabled, distance, ref, y]);

  return y;
}

export function DepartureBoard({ initialIndex = 0 }: { initialIndex?: number }) {
  const trips = CURATED_TRIPS;
  const [index, setIndex] = useState(initialIndex);
  const reduceMotion = useClientReducedMotion();

  const trip = trips[index]!;
  const peekTrip = trips[(index + 1) % trips.length]!;

  const advance = useCallback(
    (delta: number) => {
      setIndex((prev) => (((prev + delta) % trips.length) + trips.length) % trips.length);
    },
    [trips.length],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      advance(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      advance(-1);
    }
  };

  return (
    <section
      id="curated-trips"
      aria-roledescription="carousel"
      aria-label="Five curated starter trips by Tripcrew"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative w-full bg-ink text-cream focus:outline-none"
    >
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 md:gap-12 mb-14">
          <div>
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral mb-4">
              Five trips, hand-picked
            </p>
            <h2 className="font-serif text-[44px] md:text-[64px] lg:text-[72px] leading-[0.98] tracking-[-0.025em] max-w-[18ch]">
              Starter trips for the{" "}
              <span className="font-serif italic">founding crews.</span>
            </h2>
            <p className="mt-6 text-[16px] md:text-[18px] leading-[1.5] text-cream/75 max-w-[58ch]">
              Apply once and the AI plans any of them, scaled to your crew, your
              dates, your budget. The plan is yours, not a template.
            </p>
          </div>

          <BoardControls
            index={index}
            total={trips.length}
            onPrev={() => advance(-1)}
            onNext={() => advance(1)}
          />
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4 md:gap-6">
          <FeatureCard
            trip={trip}
            reduceMotion={reduceMotion}
            onAdvance={advance}
          />
          <PeekCard trip={peekTrip} onClick={() => advance(1)} />
        </div>

        <PhotoCredit trip={trip} />
      </div>
    </section>
  );
}

function BoardControls({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-5">
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/65">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <div className="flex items-center gap-2">
        <m.button
          type="button"
          onClick={onPrev}
          aria-label="Previous trip"
          whileHover="hover"
          whileTap="tap"
          className="w-12 h-12 border-2 border-cream/40 text-cream hover:border-marketing-coral hover:text-marketing-coral transition-colors duration-150 flex items-center justify-center"
        >
          <m.span
            aria-hidden="true"
            variants={{ hover: { x: -3 }, tap: { x: -5 } }}
            transition={{ duration: duration.hover, ease: easeOutExpo }}
          >
            ←
          </m.span>
        </m.button>
        <m.button
          type="button"
          onClick={onNext}
          aria-label="Next trip"
          whileHover="hover"
          whileTap="tap"
          className="w-12 h-12 border-2 border-cream/40 text-cream hover:border-marketing-coral hover:text-marketing-coral transition-colors duration-150 flex items-center justify-center"
        >
          <m.span
            aria-hidden="true"
            variants={{ hover: { x: 3 }, tap: { x: 5 } }}
            transition={{ duration: duration.hover, ease: easeOutExpo }}
          >
            →
          </m.span>
        </m.button>
      </div>
    </div>
  );
}

function FeatureCard({
  trip,
  reduceMotion,
  onAdvance,
}: {
  trip: CuratedTrip;
  reduceMotion: boolean;
  onAdvance: (delta: number) => void;
}) {
  const onDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const distance = info.offset.x;
    const velocity = info.velocity.x;
    if (distance < -80 || velocity < -300) onAdvance(1);
    if (distance > 80 || velocity > 300) onAdvance(-1);
  };

  return (
    <m.article
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={onDragEnd}
      className="relative aspect-[16/10] md:aspect-[3/2] overflow-hidden border-2 border-cream/15 touch-pan-y"
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={trip.slug}
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.02 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: duration.crossfade, ease: easeOutExpo }}
        >
          <m.div
            className="absolute inset-0"
            animate={reduceMotion ? undefined : { scale: 1.05 }}
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: duration.kenBurns,
                    ease: "linear",
                    repeat: Infinity,
                    repeatType: "mirror",
                  }
            }
          >
            <Image
              src={trip.heroPhotoUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 1100px, 100vw"
              className="object-cover"
              priority
            />
          </m.div>
        </m.div>
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-ink via-ink/65 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={`copy-${trip.slug}`}
            className="flex flex-col gap-4 max-w-[44ch]"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
          >
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/85">
              {trip.country}
            </p>
            <h3 className="font-serif text-[56px] sm:text-[80px] lg:text-[104px] leading-[0.88] tracking-[-0.035em] text-cream">
              {trip.city}
            </h3>
            <p className="font-serif italic text-[17px] sm:text-[20px] leading-[1.3] text-cream max-w-[42ch]">
              {trip.tagline}
            </p>
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/85">
              £{trip.perHeadAmount.toLocaleString("en-GB")} pp
              <span aria-hidden="true" className="mx-3 text-cream/40">
                ·
              </span>
              {trip.crewLabel}
              <span aria-hidden="true" className="mx-3 text-cream/40">
                ·
              </span>
              {trip.vibesLabel}
            </p>
            <div className="mt-4">
              <Link
                href={`/curated/${trip.slug}`}
                className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-6 border-2 border-marketing-coral hover:bg-cream hover:text-ink hover:border-cream transition-colors duration-150 whitespace-nowrap"
              >
                Plan your {trip.city} →
              </Link>
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </m.article>
  );
}

function PeekCard({
  trip,
  onClick,
}: {
  trip: CuratedTrip;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useClientReducedMotion();
  const y = useViewportParallaxY(ref, reduceMotion);

  return (
    <m.button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={`Next: ${trip.city}, ${trip.country}`}
      className="group relative aspect-[16/10] md:aspect-auto md:h-full overflow-hidden border-2 border-cream/15 hover:border-marketing-coral transition-colors duration-150 text-left"
    >
      <m.div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.02]"
        style={reduceMotion ? undefined : { y }}
      >
        <Image
          src={trip.heroPhotoUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 480px, (min-width: 768px) 320px, 100vw"
          className="object-cover"
        />
      </m.div>
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-ink via-ink/55 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
        <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/85 mb-2.5">
          Up next
        </p>
        <p className="font-serif text-[26px] sm:text-[32px] leading-[0.95] tracking-[-0.02em] text-cream">
          {trip.city}
        </p>
        <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/85 mt-1.5">
          {trip.country}
        </p>
      </div>
    </m.button>
  );
}

function PhotoCredit({ trip }: { trip: CuratedTrip }) {
  return (
    <p className="mt-6 font-mono uppercase tracking-[0.18em] text-[9px] text-cream/65">
      Photo ·{" "}
      <a
        href={trip.heroPhotoCredit.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-4 hover:text-cream hover:underline"
      >
        {trip.heroPhotoCredit.name} on Unsplash
      </a>
    </p>
  );
}
