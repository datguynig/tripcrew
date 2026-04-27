"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveApplication } from "@/lib/actions/approveApplication";
import {
  rejectApplication,
  updateAdminNotes,
} from "@/lib/actions/rejectApplication";
import { MAX_SCORE } from "@/lib/applications/scoring";
import {
  TRIPS_PER_YEAR_LABEL,
  ROLE_LABEL,
  PAIN_LABEL,
  BUDGET_ATTITUDE_LABEL,
} from "@/lib/applications/answerLabels";
import type { Application } from "@/lib/types";

type Props = {
  application: Application;
  score: number;
  scoreExplanation: string;
};

type Status = "pending" | "approved" | "rejected";

function deriveStatus(application: Application): Status {
  if (application.approved_at) return "approved";
  if (application.rejected_at) return "rejected";
  return "pending";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function ApplicationDetail({
  application,
  score,
  scoreExplanation,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>(application.admin_notes ?? "");
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);
  const [isSavingNotes, startSavingNotes] = useTransition();

  const status = deriveStatus(application);
  const scorePct = Math.max(0, Math.min(100, (score / MAX_SCORE) * 100));

  useEffect(() => {
    if (notesSavedAt === null) return;
    const timeout = window.setTimeout(() => setNotesSavedAt(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [notesSavedAt]);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveApplication(application.id);
      if ("ok" in result && result.ok) {
        router.push("/admin/applications/queue");
        return;
      }
      setError(result.error ?? "Could not approve.");
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectApplication(application.id);
      if ("ok" in result && result.ok) {
        router.push("/admin/applications/queue");
        return;
      }
      setError(result.error ?? "Could not reject.");
    });
  }

  function handleSaveNotes() {
    startSavingNotes(async () => {
      const result = await updateAdminNotes(application.id, notes);
      if ("ok" in result && result.ok) {
        setNotesSavedAt(Date.now());
      }
    });
  }

  const statusToneClass =
    status === "pending"
      ? "text-marketing-coral"
      : status === "approved"
        ? "text-cream/65"
        : "text-cream/40";

  return (
    <div className="min-h-screen bg-ink text-cream">
      <div className="mx-auto flex max-w-[760px] flex-col gap-10 px-6 py-12 md:px-12">
        <header className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream">
            Application
            <span className="px-2 text-cream/40">·</span>
            <span className="normal-case tracking-normal">
              {application.email}
            </span>
          </p>
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.18em] ${statusToneClass}`}
          >
            {status}
            <span className="px-2 text-cream/40">·</span>
            <span className="text-cream/40">
              {timeAgo(application.created_at)}
            </span>
          </p>
        </header>

        <section className="flex flex-col gap-10">
          <AnswerBlock
            number="01"
            prompt="Trips per year"
            answer={TRIPS_PER_YEAR_LABEL[application.trips_per_year]}
          />
          <AnswerBlock
            number="02"
            prompt="When your crew talks about a trip, you're..."
            answer={ROLE_LABEL[application.role]}
          />
          <AnswerBlock
            number="03"
            prompt="What kills most of your trips?"
            answer={PAIN_LABEL[application.pain]}
          />
          <AnswerBlock
            number="04"
            prompt="When it comes to trip budgets, you..."
            answer={BUDGET_ATTITUDE_LABEL[application.budget_attitude]}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-cream/15 pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream">
            Score
            <span className="px-2 text-cream/40">·</span>
            <span className="text-marketing-coral">{score.toFixed(1)}</span>
            <span className="text-cream/40"> / {MAX_SCORE}</span>
          </p>
          <div
            className="h-[2px] w-full bg-cream/10"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={MAX_SCORE}
          >
            <div
              className="h-full bg-marketing-coral"
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <p className="text-[14px] leading-relaxed text-cream/80">
            {scoreExplanation}
          </p>
        </section>

        {(application.utm_source || application.referrer) && (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream/65">
            Source
            <span className="px-2 text-cream/40">·</span>
            <span className="normal-case tracking-normal">
              {application.referrer ?? "direct"}
            </span>
            {application.utm_source && (
              <>
                <span className="px-2 text-cream/40">·</span>
                UTM
                <span className="px-2 text-cream/40">·</span>
                <span className="normal-case tracking-normal">
                  {application.utm_source}
                </span>
              </>
            )}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <label
            htmlFor="admin-notes"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream"
          >
            Admin notes
          </label>
          <textarea
            id="admin-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-y border border-cream/30 bg-transparent p-3 text-[14px] text-cream outline-none placeholder:text-cream/30 focus:border-marketing-coral"
          />
          <div>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="border border-cream/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream disabled:opacity-50"
            >
              {notesSavedAt !== null ? "Saved" : "Save notes"}
            </button>
          </div>
        </section>

        {status === "pending" && (
          <section className="flex flex-col gap-4 border-t border-cream/15 pt-8">
            {error && (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-400">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-marketing-coral px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Approve & send invite
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="border border-cream/40 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AnswerBlock({
  number,
  prompt,
  answer,
}: {
  number: string;
  prompt: string;
  answer: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream/65">
        <span className="text-marketing-coral">{number}</span>
        <span className="px-2 text-cream/40">·</span>
        {prompt}
      </p>
      <p className="font-serif text-[22px] leading-snug text-cream">{answer}</p>
    </div>
  );
}
