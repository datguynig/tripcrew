"use client";

import { useState, useTransition } from "react";
import { createInvite } from "@/lib/actions/invites";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Person = { id: string; name: string };

type Props = {
  tripId: string;
  people: Person[];
};

export function PriorCrewChips({ tripId, people }: Props) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const toast = useToast();

  const visible = people.filter((p) => !dismissed.has(p.id));

  const invite = (person: Person) => {
    setBusyId(person.id);
    startTransition(async () => {
      const res = await createInvite(tripId);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success(`Link copied — paste it to ${person.name}.`);
      } catch {
        toast.info(`Link ready for ${person.name}. Copy it from the list below.`);
      }
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(person.id);
        return next;
      });
    });
  };

  if (visible.length === 0) return null;

  return (
    <Card tone="flat" className="mt-8">
      <div className="label-sm-wide text-fg-3 mb-1">
        Previously traveled with
      </div>
      <p className="body-sm text-fg-2 mb-4 max-w-[520px]">
        Click to generate an invite link and copy it. Paste it to them however
        you like.
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((p) => {
          const isBusy = pending && busyId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => invite(p)}
              disabled={isBusy}
              className="flex items-center gap-2 py-[6px] pl-[6px] pr-[12px] border border-line rounded-full bg-bg-2 hover:border-line-2 hover:bg-bg-3 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            >
              <span className="w-[22px] h-[22px] bg-fg text-bg rounded-full flex items-center justify-center text-[10px] font-semibold font-mono">
                {getInitials(p.name)}
              </span>
              <span className="text-[13px] font-medium tracking-[-0.01em] max-w-[160px] truncate">
                {p.name}
              </span>
              <span className="label-xs text-fg-3">
                {isBusy ? "…" : "Invite"}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
