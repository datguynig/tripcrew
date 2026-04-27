"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { applicationEmailSchema } from "@/lib/validators/application";

import { MembershipStamp } from "./MembershipStamp";

type HeroProps = {
  applicantCount: number;
};

const SPEC_CELLS: { label: string; value: string }[] = [
  { label: "Per head", value: "£820" },
  { label: "Crew", value: "6" },
  { label: "From", value: "LHR" },
  { label: "Vibes", value: "Foodie · Wine" },
];

const DEAD_BUBBLES: string[] = [
  "anyone free in june?",
  "depends on dates",
  "lisbon? portugal?",
  "i'll check flights later",
];

export function Hero({ applicantCount }: HeroProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = applicationEmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
      return;
    }
    startTransition(() => {
      router.push(`/apply?email=${encodeURIComponent(parsed.data)}`);
    });
  }

  return (
    <section className="relative overflow-hidden bg-ink text-cream">
      <div className="absolute right-6 top-6 z-10 sm:right-10 sm:top-10">
        <MembershipStamp count={applicantCount} />
      </div>

      <div className="mx-auto max-w-[1200px] px-6 pt-24 pb-16 sm:px-10 sm:pt-28 sm:pb-20 lg:pt-32 lg:pb-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="font-serif text-[44px] leading-[1.02] tracking-[-0.025em] sm:text-[56px] lg:text-[68px]">
              Trips that make it out of the group chat.
            </h1>
            <p className="mt-6 max-w-[28ch] text-[17px] leading-relaxed text-cream/70 sm:text-[19px]">
              Pick a city. Pull your crew. Make memories, not just wishes.
            </p>
          </div>

          <div className="flex items-center">
            <TransformationSplit />
          </div>
        </div>

        <div className="mt-14 sm:mt-20">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="flex flex-col border-2 border-cream sm:flex-row">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-label="Email address"
                placeholder="your@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flex-1 bg-transparent px-5 py-4 text-[16px] text-cream placeholder:text-cream/40 focus:outline-none sm:text-[17px]"
              />
              <button
                type="submit"
                disabled={isPending}
                className="border-cream bg-cream px-6 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:border-l-2"
              >
                {isPending ? "Loading..." : "Continue →"}
              </button>
            </div>

            {error && (
              <p
                role="alert"
                className="font-mono uppercase tracking-[0.18em] text-[11px]"
                style={{ color: "#ff7a5c" }}
              >
                {error}
              </p>
            )}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/55">
                4 quick questions next · 90 seconds
              </p>
              <Link
                href="/sign-in"
                className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/70 underline-offset-4 hover:text-cream hover:underline"
              >
                Have an invite? Enter →
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function TransformationSplit() {
  return (
    <div className="grid w-full grid-cols-1 border-2 border-cream/30 sm:grid-cols-2">
      <div className="relative border-b-2 border-cream/30 p-6 sm:border-b-0 sm:border-r-2">
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/50">
          The group chat
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {DEAD_BUBBLES.map((bubble, index) => (
            <div
              key={index}
              className="max-w-[85%] border border-cream/20 bg-cream/[0.04] px-3 py-2 text-[13px] leading-snug text-cream line-through opacity-55"
              style={{
                alignSelf: index % 2 === 0 ? "flex-start" : "flex-end",
              }}
            >
              {bubble}
            </div>
          ))}
        </div>
        <p className="mt-5 font-mono uppercase tracking-[0.18em] text-[9px] text-cream/30">
          ... 47 unread
        </p>
      </div>

      <div className="relative bg-cream p-6 text-ink">
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/60">
          The trip
        </p>
        <h3 className="mt-4 font-serif text-[36px] leading-none tracking-[-0.02em]">
          Lisbon
        </h3>
        <p className="mt-2 font-mono uppercase tracking-[0.14em] text-[10px] text-ink/70">
          Jun 14 — Jun 19 · 6 days · 6 crew
        </p>
        <div className="mt-5 grid grid-cols-2 border-2 border-ink">
          {SPEC_CELLS.map((cell, index) => {
            const isRightCol = index % 2 === 1;
            const isBottomRow = index >= 2;
            return (
              <div
                key={cell.label}
                className={[
                  "px-3 py-3",
                  isRightCol ? "" : "border-r-2 border-ink",
                  isBottomRow ? "" : "border-b-2 border-ink",
                ].join(" ")}
              >
                <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/60">
                  {cell.label}
                </p>
                <p className="mt-1.5 font-mono text-[14px] tracking-[0.02em] text-ink">
                  {cell.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
