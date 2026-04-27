"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitApplication } from "@/lib/actions/applications";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

const TRIPS_OPTIONS: ApplicationTripsPerYear[] = ["0", "1", "2-3", "4+"];

const ROLE_OPTIONS: { label: string; value: ApplicationRole }[] = [
  { label: "The one who organises it", value: "organiser" },
  { label: "The one who shows up", value: "attendee" },
  { label: "Depends on the trip", value: "depends" },
];

const PAIN_OPTIONS: { label: string; value: ApplicationPain }[] = [
  { label: "Dates never align", value: "dates" },
  { label: "Nobody books anything", value: "booking" },
  { label: "Money gets weird", value: "money" },
  { label: "Plan never gets made", value: "plan" },
  { label: "Trips happen but feel chaotic", value: "chaos" },
];

const BUDGET_OPTIONS: { label: string; value: ApplicationBudgetAttitude }[] = [
  { label: "Treat it like monopoly money", value: "monopoly" },
  { label: "Splurge on what matters", value: "splurge" },
  { label: "Make every pound count", value: "count" },
  { label: "It depends on the trip", value: "depends" },
];

const LEGEND_CLASS =
  "block mb-4 font-mono uppercase tracking-[0.18em] text-[12px] text-ink";

const OPTION_BASE =
  "inline-flex items-center border-2 border-ink transition-[background-color,color] duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

function classes(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function ApplicationForm({ email }: { email: string }) {
  const router = useRouter();
  const [tripsPerYear, setTripsPerYear] =
    useState<ApplicationTripsPerYear | null>(null);
  const [role, setRole] = useState<ApplicationRole | null>(null);
  const [pain, setPain] = useState<ApplicationPain | null>(null);
  const [budgetAttitude, setBudgetAttitude] =
    useState<ApplicationBudgetAttitude | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allAnswered =
    tripsPerYear !== null &&
    role !== null &&
    pain !== null &&
    budgetAttitude !== null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      tripsPerYear === null ||
      role === null ||
      pain === null ||
      budgetAttitude === null
    ) {
      return;
    }
    setError(null);
    const payload = {
      email,
      trips_per_year: tripsPerYear,
      role,
      pain,
      budget_attitude: budgetAttitude,
    };
    startTransition(async () => {
      const result = await submitApplication(payload);
      if (result.ok) {
        router.push(`/apply/confirmation?p=${result.pain}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-12">
      <fieldset>
        <legend className={LEGEND_CLASS}>01 / Trips per year</legend>
        <div className="grid grid-cols-4 gap-3">
          {TRIPS_OPTIONS.map((value) => {
            const selected = tripsPerYear === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTripsPerYear(value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "justify-center min-h-[56px] font-mono text-[15px] tracking-[0.05em]",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>
          02 / When your crew talks about a trip, you&apos;re...
        </legend>
        <div className="flex flex-col gap-3">
          {ROLE_OPTIONS.map((option) => {
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>
          03 / What kills most of your trips?
        </legend>
        <div className="flex flex-col gap-3">
          {PAIN_OPTIONS.map((option) => {
            const selected = pain === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPain(option.value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>
          04 / When it comes to trip budgets, you...
        </legend>
        <div className="flex flex-col gap-3">
          {BUDGET_OPTIONS.map((option) => {
            const selected = budgetAttitude === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBudgetAttitude(option.value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-col items-start gap-4">
        {error && (
          <p
            role="alert"
            className="font-mono uppercase tracking-[0.18em] text-[12px] text-[#c62828]"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!allAnswered || isPending}
          className={classes(
            "border-2 px-6 min-h-[56px] font-mono uppercase tracking-[0.18em] text-[12px] transition-[background-color,color,border-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
            !allAnswered || isPending
              ? "bg-transparent text-ink/40 border-ink/40 cursor-not-allowed"
              : "bg-ink text-cream border-ink cursor-pointer hover:opacity-90",
          )}
        >
          {isPending ? "Submitting..." : "Submit application →"}
        </button>
      </div>
    </form>
  );
}
