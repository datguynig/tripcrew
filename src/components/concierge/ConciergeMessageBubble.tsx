"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { applyConciergeProposal } from "@/lib/actions/applyConciergeProposal";
import type { ConciergeMessage, ConciergeProposal } from "@/lib/types";

type Props = {
  message: ConciergeMessage;
  onProposalApplied: (updated: ConciergeMessage) => void;
};

export function ConciergeMessageBubble({ message, onProposalApplied }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`grid gap-2 ${isUser ? "justify-items-end" : "justify-items-start"}`}>
      <div
        className={[
          "max-w-[85%] px-4 py-3 rounded-md text-[14px] leading-[1.55] whitespace-pre-wrap",
          isUser
            ? "bg-fg text-bg"
            : "bg-bg-3 text-fg border border-line",
        ].join(" ")}
      >
        {message.content || <span className="italic text-fg-3">(empty reply)</span>}
      </div>

      {!isUser && message.proposals && message.proposals.length > 0 && (
        <div className="grid gap-2 max-w-[85%] mt-1">
          {message.proposals.map((proposal, idx) => (
            <ProposalCard
              key={idx}
              proposal={proposal}
              messageId={message.id}
              proposalIndex={idx}
              onApplied={onProposalApplied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  messageId,
  proposalIndex,
  onApplied,
}: {
  proposal: ConciergeProposal;
  messageId: string;
  proposalIndex: number;
  onApplied: (updated: ConciergeMessage) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const applied = !!proposal.applied_at;

  function handleApply() {
    if (applied || isPending) return;
    startTransition(async () => {
      const result = await applyConciergeProposal({ messageId, proposalIndex });
      if ("ok" in result && result.ok) {
        onApplied(result.updated);
      }
    });
  }

  return (
    <div className="border border-line bg-bg-2 p-4 grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-sm text-accent">{labelFor(proposal)}</span>
        {applied && (
          <span className="label-xs text-fg-3 italic">
            Applied · {formatTime(proposal.applied_at as string)}
          </span>
        )}
      </div>
      <ProposalBody proposal={proposal} />
      {!applied && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleApply}
          disabled={isPending}
        >
          {isPending ? "Applying…" : "Apply"}
        </Button>
      )}
    </div>
  );
}

function ProposalBody({ proposal }: { proposal: ConciergeProposal }) {
  switch (proposal.kind) {
    case "activity_add":
      return (
        <div className="grid gap-1">
          <p className="text-[14px] font-medium tracking-[-0.01em]">
            {proposal.payload.name}
          </p>
          <p className="text-[13px] text-fg-2 leading-[1.5]">
            {proposal.payload.description}
          </p>
          {(proposal.payload.location || proposal.payload.day) && (
            <p className="label-xs text-fg-3">
              {proposal.payload.location ?? ""}
              {proposal.payload.location && proposal.payload.day ? " · " : ""}
              {proposal.payload.day ? `Day ${proposal.payload.day}` : ""}
            </p>
          )}
        </div>
      );

    case "schedule_revise":
      return (
        <div className="grid gap-2">
          <p className="text-[14px] font-medium tracking-[-0.01em]">
            Day {proposal.payload.day} schedule
          </p>
          <ul className="grid gap-[6px]">
            {proposal.payload.slots.map((slot, i) => (
              <li key={i} className="text-[13px] text-fg-2 leading-[1.45]">
                <span className="font-mono text-fg-3">{slot.time}</span> ·{" "}
                {slot.title}
                {slot.note && (
                  <span className="text-fg-3">. {slot.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "budget_change":
      return (
        <div className="grid gap-1">
          <p className="text-[14px] font-medium tracking-[-0.01em]">
            New target: {proposal.payload.currency}
            {proposal.payload.new_target_pp.toLocaleString()} per person
          </p>
          <p className="text-[13px] text-fg-2 leading-[1.5]">
            {proposal.payload.reason}
          </p>
        </div>
      );

    default: {
      const _never: never = proposal;
      void _never;
      return null;
    }
  }
}

function labelFor(proposal: ConciergeProposal): string {
  switch (proposal.kind) {
    case "activity_add":
      return "Add activity";
    case "schedule_revise":
      return "Revise schedule";
    case "budget_change":
      return "Adjust budget";
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
