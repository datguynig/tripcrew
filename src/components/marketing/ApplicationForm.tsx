"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitApplication } from "@/lib/actions/applications";
import {
  BUDGET_ATTITUDE_LABEL,
  BUDGET_ATTITUDE_OPTIONS,
  PAIN_LABEL,
  PAIN_OPTIONS,
  ROLE_LABEL,
  ROLE_OPTIONS,
  TRIPS_PER_YEAR_OPTIONS,
} from "@/lib/applications/answerLabels";
import { applicationEmailSchema } from "@/lib/validators/application";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

const LEGEND_CLASS =
  "block mb-4 font-mono uppercase tracking-[0.18em] text-[12px] text-ink";

const OPTION_BASE =
  "inline-flex items-center border-2 border-ink transition-[background-color,color] duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

function classes(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function ApplicationForm({ email: initialEmail }: { email: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
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
    const parsedEmail = applicationEmailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError(parsedEmail.error.issues[0]?.message ?? "Enter a valid email.");
      return;
    }
    setError(null);
    const payload = {
      email: parsedEmail.data,
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
        <legend className={LEGEND_CLASS}>01 / Your email</legend>
        <input
          id="application-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full bg-transparent border-2 border-ink px-5 py-4 text-[16px] text-ink placeholder:text-ink/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        />
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>02 / Trips per year</legend>
        <div className="grid grid-cols-4 gap-3">
          {TRIPS_PER_YEAR_OPTIONS.map((value) => {
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
          03 / When your crew talks about a trip, you&apos;re...
        </legend>
        <div className="flex flex-col gap-3">
          {ROLE_OPTIONS.map((value) => {
            const selected = role === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {ROLE_LABEL[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>
          04 / What kills most of your trips?
        </legend>
        <div className="flex flex-col gap-3">
          {PAIN_OPTIONS.map((value) => {
            const selected = pain === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPain(value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {PAIN_LABEL[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LEGEND_CLASS}>
          05 / When it comes to trip budgets, you...
        </legend>
        <div className="flex flex-col gap-3">
          {BUDGET_ATTITUDE_OPTIONS.map((value) => {
            const selected = budgetAttitude === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setBudgetAttitude(value)}
                aria-pressed={selected}
                className={classes(
                  OPTION_BASE,
                  "text-left min-h-[64px] px-5 py-4 text-[15px] leading-snug",
                  selected
                    ? "bg-ink text-cream"
                    : "bg-transparent text-ink hover:border-[3px] hover:m-[-1px]",
                )}
              >
                {BUDGET_ATTITUDE_LABEL[value]}
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
