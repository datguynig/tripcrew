"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  castDestinationVote,
  lockDestination,
  proposeCandidate,
  removeCandidate,
} from "@/lib/actions/destinations";
import type { DestinationCandidate, DestinationVote } from "@/lib/types";

type Props = {
  tripId: string;
  initialCandidates: DestinationCandidate[];
  initialVotes: DestinationVote[];
  currentUserId: string;
  isAdmin: boolean;
  voteDeadline: string | null;
  locked: boolean;
  lockedDestination: string | null;
};

type Filter = "all";
type VoteChoice = "yes" | "maybe" | "no";

function formatDeadline(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "Deadline passed";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

export function Destinations({
  tripId,
  initialCandidates,
  initialVotes,
  currentUserId,
  isAdmin,
  voteDeadline,
  locked,
  lockedDestination,
}: Props) {
  const [candidates, setCandidates] =
    useState<DestinationCandidate[]>(initialCandidates);
  const [votes, setVotes] = useState<DestinationVote[]>(initialVotes);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setCandidates(initialCandidates), [initialCandidates]);
  useEffect(() => setVotes(initialVotes), [initialVotes]);

  useEffect(() => {
    if (!voteDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [voteDeadline]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rt:destinations:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "destination_candidates",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setCandidates((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as DestinationCandidate;
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as DestinationCandidate;
              return prev.map((c) => (c.id === row.id ? row : c));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((c) => c.id !== row.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "destination_votes",
        },
        (payload) => {
          setVotes((prev) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const row = payload.new as DestinationVote;
              const idx = prev.findIndex(
                (v) =>
                  v.candidate_id === row.candidate_id &&
                  v.user_id === row.user_id,
              );
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = row;
                return copy;
              }
              return [...prev, row];
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<DestinationVote>;
              return prev.filter(
                (v) =>
                  !(
                    v.candidate_id === old.candidate_id &&
                    v.user_id === old.user_id
                  ),
              );
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const counts = useMemo(() => {
    const c = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const v of votes) {
      const row = c.get(v.candidate_id) ?? { yes: 0, maybe: 0, no: 0 };
      row[v.vote]++;
      c.set(v.candidate_id, row);
    }
    return c;
  }, [votes]);

  const myVote = useMemo(() => {
    const m = new Map<string, VoteChoice>();
    for (const v of votes) {
      if (v.user_id === currentUserId) m.set(v.candidate_id, v.vote);
    }
    return m;
  }, [votes, currentUserId]);

  const ranked = useMemo(() => {
    return candidates.slice().sort((a, b) => {
      const ca = counts.get(a.id) ?? { yes: 0, maybe: 0, no: 0 };
      const cb = counts.get(b.id) ?? { yes: 0, maybe: 0, no: 0 };
      const sa = ca.yes * 2 + ca.maybe;
      const sb = cb.yes * 2 + cb.maybe;
      if (sb !== sa) return sb - sa;
      return a.position - b.position;
    });
  }, [candidates, counts]);

  const deadlineText = voteDeadline ? formatDeadline(voteDeadline) : null;
  const deadlinePassed =
    voteDeadline !== null && new Date(voteDeadline).getTime() <= now;

  const handlePropose = () => {
    const t = title.trim();
    if (!t) return;
    setError(null);
    setTitle("");
    setNote("");
    startTransition(async () => {
      const res = await proposeCandidate({
        tripId,
        title: t,
        note: note.trim() || null,
      });
      if (res?.error) setError(res.error);
    });
  };

  const handleVote = (candidateId: string, next: VoteChoice) => {
    const current = myVote.get(candidateId);
    const vote = current === next ? null : next;
    startTransition(async () => {
      await castDestinationVote({ candidateId, vote });
    });
  };

  const handleRemove = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      await removeCandidate(id);
    });
  };

  const handleLock = () => {
    setError(null);
    startTransition(async () => {
      const res = await lockDestination(tripId);
      if (res?.error) setError(res.error);
    });
  };

  if (locked) {
    return (
      <>
        <div className="border border-line p-6 mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-2">
              Locked
            </div>
            <div className="text-[28px] font-medium tracking-[-0.02em]">
              {lockedDestination ?? "—"}
            </div>
          </div>
          <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-ok">
            Decision made
          </div>
        </div>

        {ranked.length > 0 && (
          <>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-3">
              Vote history
            </div>
            <div className="border border-line">
              {ranked.map((c) => {
                const cc = counts.get(c.id) ?? { yes: 0, maybe: 0, no: 0 };
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_auto] py-[14px] px-6 border-b border-line last:border-b-0 gap-4 items-baseline"
                  >
                    <div className="text-[15px] font-medium tracking-[-0.01em]">
                      {c.title}
                    </div>
                    <div className="font-mono text-[10px] tracking-[0.08em] text-fg-3">
                      <span className="text-fg mr-1">{cc.yes}</span>YES ·{" "}
                      <span className="text-fg mr-1">{cc.maybe}</span>MEH ·{" "}
                      <span className="text-fg mr-1">{cc.no}</span>NO
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {deadlineText && (
        <div
          className={`inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase py-[6px] px-3 rounded-full border mb-6 ${
            deadlinePassed
              ? "border-err/40 text-err"
              : "border-line-2 text-fg-2"
          }`}
        >
          <span
            className={`w-[6px] h-[6px] rounded-full ${deadlinePassed ? "bg-err" : "bg-warn"}`}
          />
          {deadlinePassed ? "Deadline passed" : `Closes in ${deadlineText}`}
        </div>
      )}

      <div className="border border-line p-[18px] px-5 mb-7 grid gap-[10px]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePropose();
            }
          }}
          placeholder="Propose a destination (e.g. Lisbon)"
          maxLength={120}
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Pitch it (optional, ≤280 chars)"
          maxLength={280}
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 min-h-[56px] leading-[1.5] resize-y"
        />
        <div className="flex justify-between items-center gap-3">
          {error && (
            <span className="text-err font-mono text-[11px] uppercase tracking-[0.08em]">
              {error}
            </span>
          )}
          <button
            onClick={handlePropose}
            className="bg-fg text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer active:scale-[0.98] ml-auto"
          >
            Propose
          </button>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="border border-line py-14 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          No candidates · propose one
        </div>
      ) : (
        <div className="border border-line">
          {ranked.map((c, i) => {
            const cc = counts.get(c.id) ?? { yes: 0, maybe: 0, no: 0 };
            const total = cc.yes + cc.maybe + cc.no;
            const mine = myVote.get(c.id);
            const canRemove = isAdmin || c.proposed_by === currentUserId;
            const leader = i === 0;
            return (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_220px_160px_36px] max-[780px]:grid-cols-1 items-center py-[18px] px-6 border-b border-line last:border-b-0 gap-5"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {leader && total > 0 && (
                      <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-accent">
                        Leading
                      </span>
                    )}
                    <div className="text-[17px] font-medium tracking-[-0.015em]">
                      {c.title}
                    </div>
                  </div>
                  {c.note && (
                    <div className="text-[13px] text-fg-2 leading-[1.45]">
                      {c.note}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex h-1 bg-bg-3 rounded-full overflow-hidden">
                    {total > 0 && (
                      <>
                        <div
                          className="bg-ok"
                          style={{ width: `${(cc.yes / total) * 100}%` }}
                        />
                        <div
                          className="bg-warn"
                          style={{ width: `${(cc.maybe / total) * 100}%` }}
                        />
                        <div
                          className="bg-err"
                          style={{ width: `${(cc.no / total) * 100}%` }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex gap-3 mt-2 font-mono text-[10px] tracking-[0.08em] text-fg-3">
                    <span>
                      <b className="text-fg font-medium mr-1">{cc.yes}</b>YES
                    </span>
                    <span>
                      <b className="text-fg font-medium mr-1">{cc.maybe}</b>MEH
                    </span>
                    <span>
                      <b className="text-fg font-medium mr-1">{cc.no}</b>NO
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 justify-self-end max-[780px]:justify-self-start">
                  <VoteBtn
                    active={mine === "yes"}
                    tone="yes"
                    onClick={() => handleVote(c.id, "yes")}
                  >
                    YES
                  </VoteBtn>
                  <VoteBtn
                    active={mine === "maybe"}
                    tone="maybe"
                    onClick={() => handleVote(c.id, "maybe")}
                  >
                    MEH
                  </VoteBtn>
                  <VoteBtn
                    active={mine === "no"}
                    tone="no"
                    onClick={() => handleVote(c.id, "no")}
                  >
                    NO
                  </VoteBtn>
                </div>

                {canRemove ? (
                  <button
                    onClick={() => handleRemove(c.id)}
                    aria-label="Remove candidate"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-fg-4 hover:text-err hover:bg-bg-2 transition-colors cursor-pointer text-sm max-[780px]:justify-self-start"
                  >
                    ✕
                  </button>
                ) : (
                  <div className="max-[780px]:hidden" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <div className="mt-8 border border-line p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-1">
              Admin
            </div>
            <div className="text-sm text-fg-2">
              Lock the top candidate to kick off planning. This can&apos;t be
              undone from here.
            </div>
          </div>
          <button
            onClick={handleLock}
            disabled={ranked.length === 0}
            className="bg-accent text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Lock destination
          </button>
        </div>
      )}
    </>
  );
}

function VoteBtn({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "yes" | "maybe" | "no";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "yes"
      ? "bg-ok text-[#0C3A1C] border-ok"
      : tone === "maybe"
        ? "bg-warn text-[#3A2A05] border-warn"
        : "bg-err text-[#3D0E0E] border-err";
  return (
    <button
      onClick={onClick}
      className={`w-12 h-10 text-xs font-semibold tracking-[0.02em] rounded-md border transition-colors cursor-pointer ${
        active
          ? activeClass
          : "bg-bg-2 border-line text-fg-2 hover:border-line-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
