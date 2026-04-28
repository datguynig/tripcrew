"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { applicationEmailSchema } from "@/lib/validators/application";
import type { CuratedTrip } from "@/lib/marketing/curatedTrips";

import { EditorialCollage } from "./EditorialCollage";

type HeroProps = {
  applicantCount: number;
  featuredTrip: CuratedTrip;
  foundingRemaining: number;
};

export function Hero({
  applicantCount,
  featuredTrip,
  foundingRemaining,
}: HeroProps) {
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
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,94,58,0.55)_0%,transparent_55%)]" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-6 sm:px-10 pt-14 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-[1.1fr_1fr] md:gap-16 lg:gap-24 items-center">
          <div className="flex flex-col">
            <CohortBadge
              foundingRemaining={foundingRemaining}
              applicantCount={applicantCount}
            />

            <h1 className="mt-7 font-serif text-[44px] leading-[1.0] tracking-[-0.025em] sm:text-[58px] lg:text-[72px]">
              Trips that make it
              <br />
              <span className="text-marketing-coral">
                out of the group chat.
              </span>
            </h1>

            <p className="mt-6 max-w-[38ch] text-[17px] leading-relaxed text-cream/80 sm:text-[19px]">
              Stop planning in the group chat. One place for decisions, plans,
              money, and updates. The AI drafts the trip. Your crew locks it in.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-9 flex flex-col gap-3"
              noValidate
            >
              <div className="flex flex-col border-2 border-cream sm:flex-row">
                <label htmlFor="hero-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="hero-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex-1 bg-transparent px-5 py-4 text-[16px] text-cream placeholder:text-cream/70 focus:outline-none sm:text-[17px]"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="border-cream bg-marketing-coral px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 sm:border-l-2"
                >
                  {isPending ? "Loading…" : "Apply for invite →"}
                </button>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="font-mono uppercase tracking-[0.18em] text-[11px] text-err"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/65">
                  4 questions. 90 seconds. Approved in batches.
                </p>
                <Link
                  href="/sign-in"
                  className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/80 underline-offset-4 hover:text-cream hover:underline"
                >
                  Have an invite? Enter →
                </Link>
              </div>
            </form>
          </div>

          <div className="relative">
            <EditorialCollage trip={featuredTrip} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CohortBadge({
  foundingRemaining,
  applicantCount,
}: {
  foundingRemaining: number;
  applicantCount: number;
}) {
  const claimed = Math.max(0, 500 - foundingRemaining);
  const progress = Math.min(1, claimed / 500);
  const showApplicants = applicantCount > 0;

  return (
    <div className="flex flex-col gap-2 max-w-[420px]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-[10px] h-[10px] bg-marketing-coral"
        />
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/85">
          Cohort 01 · invite only
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/65">
          Founding crew
        </p>
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream">
          {claimed} / 500 claimed
        </p>
      </div>
      <div className="relative h-[3px] bg-cream/25 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-marketing-coral"
          style={{ width: `${Math.max(progress * 100, 6)}%` }}
        />
      </div>
      {showApplicants ? (
        <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/70 mt-1">
          {applicantCount.toLocaleString("en-GB")} on the waitlist
        </p>
      ) : null}
    </div>
  );
}
