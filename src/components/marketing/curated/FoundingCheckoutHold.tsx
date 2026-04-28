"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createFoundingCheckoutSession } from "@/lib/actions/subscription";
import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import type { DraftLead } from "@/lib/types";

type FoundingCheckoutHoldProps = {
  reservationId: string;
  expiresAt: string;
  draft: DraftLead;
  trip: CuratedTrip;
};

const CREW_LABELS: Record<DraftLead["inputs"]["crew"], string> = {
  "2": "2",
  "3-4": "3–4",
  "5-6": "5–6",
  "7+": "7+",
};

const WHEN_LABELS: Record<DraftLead["inputs"]["when"], string> = {
  weekend: "A weekend",
  week: "A week",
  "two-weeks": "Two weeks",
  flexible: "Flexible",
};

function formatRemaining(ms: number): { mm: string; ss: string } {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return { mm, ss };
}

export function FoundingCheckoutHold({
  reservationId,
  expiresAt,
  draft,
  trip,
}: FoundingCheckoutHoldProps) {
  const expiresMs = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, expiresMs - Date.now()),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, expiresMs - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresMs]);

  const expired = remaining <= 0;
  const { mm, ss } = formatRemaining(remaining);
  const sub60 = remaining > 0 && remaining < 60_000;

  function onPay() {
    setError(null);
    startTransition(async () => {
      const result = await createFoundingCheckoutSession(reservationId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <main className="bg-cream text-ink relative overflow-hidden">
      <BackdropWatermark city={trip.city} photoUrl={trip.heroPhotoUrl} />

      <section className="relative mx-auto max-w-[1100px] px-6 sm:px-10 pt-16 sm:pt-20 lg:pt-24 pb-24 sm:pb-32">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`inline-block w-[8px] h-[8px] bg-marketing-coral ${expired ? "" : "animate-pulse"}`}
          />
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            Founding spot · {expired ? "Released" : "Held"}
          </p>
        </div>

        <h1 className="mt-6 font-serif font-medium leading-[0.94] tracking-[-0.035em] text-[44px] sm:text-[68px] lg:text-[86px] text-ink max-w-[20ch]">
          {expired
            ? "Your hold just expired."
            : "Your founding spot is held for 15 minutes."}
        </h1>

        <p className="mt-5 font-serif italic text-[19px] sm:text-[22px] leading-[1.35] text-ink/75 max-w-[44ch]">
          {expired
            ? "Spots are still going. Start again from the trip page and we'll re-issue a fresh hold."
            : "Pay now to lock it in. £179 / year, price-locked for life. The hold releases the moment the timer hits zero."}
        </p>

        <div className="mt-12 sm:mt-16">
          <TicketStub
            mm={mm}
            ss={ss}
            expired={expired}
            sub60={sub60}
            trip={trip}
            draft={draft}
          />
        </div>

        <div className="mt-12 sm:mt-14 flex flex-col items-start gap-5 max-w-[520px]">
          {expired ? (
            <Link
              href={`/curated/${trip.slug}`}
              className="inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[60px] px-9 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral hover:text-ink transition-colors duration-150"
            >
              Reservation expired — start again →
            </Link>
          ) : (
            <button
              type="button"
              onClick={onPay}
              disabled={isPending || expired}
              className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] sm:text-[13px] h-[64px] px-10 border-2 border-marketing-coral disabled:opacity-60 disabled:cursor-not-allowed hover:bg-ink hover:border-ink hover:text-cream transition-colors duration-150 whitespace-nowrap"
            >
              {isPending ? "Opening Stripe…" : "Pay £179 / year →"}
            </button>
          )}

          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/55">
            Price-locked for life · 14-day refund window
          </p>

          {error && (
            <p
              role="alert"
              className="font-mono uppercase tracking-[0.14em] text-[11px] text-marketing-coral-deep border-l-2 border-marketing-coral-deep pl-3"
            >
              {error}
            </p>
          )}

          <Link
            href={`/curated/${trip.slug}`}
            className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/60 hover:text-ink underline-offset-4 hover:underline mt-2"
          >
            ← Back to the {trip.city} preview
          </Link>
        </div>
      </section>
    </main>
  );
}

function BackdropWatermark({
  city,
  photoUrl,
}: {
  city: string;
  photoUrl: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
      >
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 sm:-right-12 top-[260px] sm:top-[200px] font-serif italic text-[180px] sm:text-[280px] lg:text-[380px] leading-none text-ink/[0.04] tracking-[-0.04em] select-none whitespace-nowrap"
      >
        {city}.
      </div>
    </>
  );
}

function TicketStub({
  mm,
  ss,
  expired,
  sub60,
  trip,
  draft,
}: {
  mm: string;
  ss: string;
  expired: boolean;
  sub60: boolean;
  trip: CuratedTrip;
  draft: DraftLead;
}) {
  const cells: Array<{ label: string; value: string }> = [
    { label: "Trip", value: trip.city },
    { label: "Crew", value: CREW_LABELS[draft.inputs.crew] },
    { label: "When", value: WHEN_LABELS[draft.inputs.when] },
    { label: "Founding price", value: "£179 / year" },
  ];

  return (
    <div
      className="relative border-2 border-ink bg-cream"
      style={{
        boxShadow:
          "10px 10px 0 0 var(--color-ink), 10px 10px 0 2px var(--color-ink)",
      }}
    >
      {/* Header strip — feels like a stamp / customs declaration */}
      <div className="flex items-stretch border-b-2 border-ink">
        <div className="flex items-center gap-2 px-5 py-3 border-r-2 border-ink bg-ink text-cream">
          <span aria-hidden="true" className="w-[6px] h-[6px] bg-marketing-coral" />
          <p className="font-mono uppercase tracking-[0.2em] text-[10px]">
            Reservation slip · {trip.iata}
          </p>
        </div>
        <div className="flex-1 flex items-center justify-end px-5">
          <p className="font-mono uppercase tracking-[0.2em] text-[10px] text-ink/55">
            № {String(Math.abs(hashCode(trip.slug))).slice(0, 6)}
          </p>
        </div>
      </div>

      {/* Countdown — the hero of this page */}
      <div className="px-6 sm:px-10 py-10 sm:py-14 border-b-2 border-ink relative">
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-ink/55">
          {expired ? "Released" : "Time on hold"}
        </p>
        <div
          className={`mt-4 flex items-baseline gap-3 sm:gap-5 font-mono tabular-nums tracking-[-0.04em] leading-none transition-colors duration-200 ${
            expired
              ? "text-ink/30"
              : sub60
                ? "text-marketing-coral-deep"
                : "text-ink"
          }`}
        >
          <span className="text-[88px] sm:text-[140px] lg:text-[180px] font-medium">
            {mm}
          </span>
          <span
            aria-hidden="true"
            className={`text-[64px] sm:text-[100px] lg:text-[130px] font-medium ${
              expired || sub60 ? "" : "animate-[blink_1s_steps(2,end)_infinite]"
            }`}
            style={{
              animationName: expired || sub60 ? "none" : "blink",
            }}
          >
            :
          </span>
          <span className="text-[88px] sm:text-[140px] lg:text-[180px] font-medium">
            {ss}
          </span>
          <span className="ml-3 sm:ml-5 font-mono uppercase tracking-[0.2em] text-[11px] text-ink/55 self-center">
            {expired ? "released" : "remaining"}
          </span>
        </div>

        {/* Decorative tear-line */}
        <div
          aria-hidden="true"
          className="absolute -bottom-[3px] left-0 right-0 h-[5px] flex"
        >
          <TearLine />
        </div>

        <style>{`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            50.01%, 100% { opacity: 0.25; }
          }
        `}</style>
      </div>

      {/* 4-cell strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`px-5 sm:px-6 py-5 sm:py-6 ${
              i < cells.length - 1 ? "border-r-0 sm:border-r-2 border-ink" : ""
            } ${
              i < 2 ? "border-b-2 sm:border-b-0 border-ink" : ""
            } ${i === 0 ? "border-r-2" : ""} ${i === 2 ? "border-r-2 sm:border-r-2" : ""}`}
          >
            <p className="font-mono uppercase tracking-[0.2em] text-[10px] text-ink/55">
              {cell.label}
            </p>
            <p className="mt-2 font-serif text-[22px] sm:text-[26px] leading-[1.05] tracking-[-0.02em] text-ink">
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TearLine() {
  // Decorative perforation along the tear-line between countdown and details.
  // 24 dashes — purely visual.
  return (
    <div className="flex w-full">
      {Array.from({ length: 32 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="flex-1 mx-[2px] h-[2px] bg-ink"
        />
      ))}
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
