"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveApplication } from "@/lib/actions/approveApplication";
import { rejectApplication } from "@/lib/actions/rejectApplication";
import { MAX_SCORE } from "@/lib/applications/scoring";
import { timeAgo } from "@/lib/applications/timeAgo";
import { timeRemaining } from "@/lib/applications/timeRemaining";
import type { Application } from "@/lib/types";

type Props = {
  application: Pick<
    Application,
    | "id"
    | "email"
    | "created_at"
    | "role"
    | "budget_attitude"
    | "provisional_decision"
    | "auto_decision_at"
    | "decision_finalised_at"
    | "draft_lead_id"
  >;
  score: number;
};

export function ApplicationRow({ application, score }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fillPct = Math.min(100, Math.max(0, (score / MAX_SCORE) * 100));

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveApplication(application.id);
      if ("ok" in result && result.ok) {
        router.refresh();
        return;
      }
      setError("error" in result ? result.error : "Failed.");
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectApplication(application.id);
      if ("ok" in result && result.ok) {
        router.refresh();
        return;
      }
      setError("error" in result ? result.error : "Failed.");
    });
  }

  return (
    <tr className="border-b border-cream/10 align-middle hover:bg-cream/[0.02]">
      <td className="px-4 py-3">
        <Link
          href={`/admin/applications/${application.id}`}
          className="text-cream underline decoration-cream/30 underline-offset-4 hover:decoration-cream"
        >
          {application.email}
        </Link>
        {error ? (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-red-400">
            {error}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cream/45">
        {timeAgo(application.created_at)}
      </td>
      <td className="px-4 py-3">
        <ProvisionalChip
          decision={application.provisional_decision}
          finalisedAt={application.decision_finalised_at}
        />
      </td>
      <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">
        <ExpiresLabel
          autoDecisionAt={application.auto_decision_at}
          finalisedAt={application.decision_finalised_at}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-[1.5px] flex-1 bg-cream/10">
            <div
              className="absolute inset-y-0 left-0 bg-marketing-coral"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="w-[44px] shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-cream">
            {score.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className="border border-marketing-coral px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-marketing-coral transition-colors hover:bg-marketing-coral hover:text-ink disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={pending}
            className="border border-cream/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cream/60 transition-colors hover:border-cream/60 hover:text-cream disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProvisionalChip({
  decision,
  finalisedAt,
}: {
  decision: "approve" | "reject" | null;
  finalisedAt: string | null;
}) {
  if (finalisedAt !== null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/40">
        Finalised
      </span>
    );
  }
  if (decision === null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/30">
        —
      </span>
    );
  }
  const tone =
    decision === "approve" ? "text-marketing-coral" : "text-cream/55";
  return (
    <span
      className={`inline-flex items-center gap-2 border border-current px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      <span aria-hidden="true">·</span>
      Provisional · {decision}
    </span>
  );
}

function ExpiresLabel({
  autoDecisionAt,
  finalisedAt,
}: {
  autoDecisionAt: string | null;
  finalisedAt: string | null;
}) {
  if (finalisedAt !== null) {
    return <span className="text-cream/30">—</span>;
  }
  if (autoDecisionAt === null) {
    return <span className="text-cream/30">—</span>;
  }
  const label = timeRemaining(autoDecisionAt);
  const urgent = label === "EXPIRES NOW" || label === "EXPIRED";
  return (
    <span className={urgent ? "text-marketing-coral" : "text-cream/65"}>
      {label}
    </span>
  );
}
