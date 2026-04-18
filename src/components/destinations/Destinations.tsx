"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  castDestinationVote,
  lockDestination,
  proposeCandidate,
  removeCandidate,
  unlockDestination,
} from "@/lib/actions/destinations";
import type { DestinationCandidate, DestinationVote } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DestinationSearch } from "@/components/destinations/DestinationSearch";
import { StaticMap } from "@/components/destinations/StaticMap";
import { useToast } from "@/hooks/useToast";
import { INPUT_SM } from "@/lib/styles";

type Props = {
  tripId: string;
  tripSlug: string;
  initialCandidates: DestinationCandidate[];
  initialVotes: DestinationVote[];
  currentUserId: string;
  isAdmin: boolean;
  crewCount: number;
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
  tripSlug,
  initialCandidates,
  initialVotes,
  currentUserId,
  isAdmin,
  crewCount,
  voteDeadline,
  locked,
  lockedDestination,
}: Props) {
  const [candidates, setCandidates] =
    useState<DestinationCandidate[]>(initialCandidates);
  const [votes, setVotes] = useState<DestinationVote[]>(initialVotes);
  const [title, setTitle] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<{
    mapboxId: string;
    name: string;
    longitude: number;
    latitude: number;
    country: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();

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
    // Only persist mapbox data if the user actually picked a suggestion
    // whose name matches what's in the field — otherwise they typed
    // something else after selecting, and the coords wouldn't be right.
    const coords =
      selectedPlace && t === title.trim() && selectedPlace.longitude !== null
        ? selectedPlace
        : null;
    setTitle("");
    setSelectedPlace(null);
    startTransition(async () => {
      const res = await proposeCandidate({
        tripId,
        title: t,
        note: null,
        mapboxId: coords?.mapboxId ?? null,
        longitude: coords?.longitude ?? null,
        latitude: coords?.latitude ?? null,
        country: coords?.country ?? null,
      });
      if (res?.error) setError(res.error);
    });
  };

  const handleVote = (candidateId: string, next: VoteChoice) => {
    const current = myVote.get(candidateId);
    const vote = current === next ? null : next;
    setVotes((prev) => {
      const without = prev.filter(
        (v) => !(v.candidate_id === candidateId && v.user_id === currentUserId),
      );
      if (vote === null) return without;
      return [
        ...without,
        {
          candidate_id: candidateId,
          user_id: currentUserId,
          vote,
          updated_at: new Date().toISOString(),
        },
      ];
    });
    startTransition(async () => {
      const res = await castDestinationVote({ candidateId, vote });
      if (res?.error) {
        toast.error(res.error);
        setVotes((prev) => {
          const without = prev.filter(
            (v) =>
              !(v.candidate_id === candidateId && v.user_id === currentUserId),
          );
          if (!current) return without;
          return [
            ...without,
            {
              candidate_id: candidateId,
              user_id: currentUserId,
              vote: current,
              updated_at: new Date().toISOString(),
            },
          ];
        });
      }
    });
  };

  const handleRemove = (id: string) => {
    const removed = candidates.find((c) => c.id === id);
    if (!removed) return;
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    toast.undo({
      message: `Removed "${removed.title}"`,
      duration: 5000,
      onUndo: () =>
        setCandidates((prev) =>
          [...prev, removed].sort((a, b) => a.position - b.position),
        ),
      onCommit: () =>
        startTransition(async () => {
          await removeCandidate(id);
        }),
    });
  };

  const handleLock = () => {
    setError(null);
    startTransition(async () => {
      const res = await lockDestination(tripId);
      if (res?.error) setError(res.error);
    });
  };

  const handleUnlock = () => {
    if (
      !confirm(
        "Unlock this destination? The trip goes back to voting, existing votes are kept.",
      )
    )
      return;
    startTransition(async () => {
      const res = await unlockDestination(tripId);
      if (res?.error) toast.error(res.error);
    });
  };

  if (locked) {
    return (
      <>
        <div className="border border-line p-6 mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Badge tone="muted" className="block mb-2 tracking-[0.18em]">
              Locked
            </Badge>
            <div className="text-[28px] font-medium tracking-[-0.02em]">
              {lockedDestination ?? "—"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="ok">Decision made</Badge>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUnlock}
                disabled={pending}
              >
                {pending ? "Unlocking…" : "Unlock"}
              </Button>
            )}
          </div>
        </div>

        {ranked.length > 0 && (
          <>
            <Badge tone="muted" className="block mb-3 tracking-[0.18em]">
              Vote history
            </Badge>
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

  const soloAdmin = isAdmin && crewCount <= 1;

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

      {soloAdmin && (
        <div className="border border-accent/40 bg-accent/[0.06] p-5 mb-7 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent mb-1">
              Crew of one
            </div>
            <p className="text-[14px] text-fg-2 max-w-[520px]">
              Invite the crew so they can propose and vote. A solo vote
              isn&apos;t much of a vote.
            </p>
          </div>
          <Link
            href={`/trips/${tripSlug}/crew`}
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-accent hover:text-fg transition-colors"
          >
            Invite crew →
          </Link>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="label-sm-wide text-fg-3">Add a destination</div>
          {selectedPlace && (
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase text-fg-3">
              <span className="w-[5px] h-[5px] rounded-full bg-ok" />
              Place locked
              {selectedPlace.country && (
                <span className="text-fg-2">· {selectedPlace.country}</span>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] max-[520px]:grid-cols-1 gap-2">
          <DestinationSearch
            value={title}
            onChange={(v) => {
              setTitle(v);
              if (selectedPlace && v !== selectedPlace.name) {
                setSelectedPlace(null);
              }
            }}
            onSelect={(place) =>
              setSelectedPlace({
                mapboxId: place.mapboxId,
                name: place.name,
                longitude: place.longitude,
                latitude: place.latitude,
                country: place.country,
              })
            }
            onEnter={handlePropose}
          />
          <Button
            onClick={handlePropose}
            disabled={pending || !title.trim()}
            tone={selectedPlace ? "accent" : undefined}
          >
            {pending ? "Proposing…" : "Propose →"}
          </Button>
        </div>
        {error && (
          <div className="mt-2 text-err font-mono text-[11px] uppercase tracking-[0.08em]">
            {error}
          </div>
        )}
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
                <div className="flex gap-3 items-start">
                  {c.longitude !== null && c.latitude !== null && (
                    <StaticMap
                      longitude={c.longitude}
                      latitude={c.latitude}
                      width={88}
                      height={62}
                      zoom={4}
                      alt={`Map of ${c.title}`}
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {leader && total > 0 && (
                        <Badge tone="accent" size="sm">Leading</Badge>
                      )}
                      <div className="text-[17px] font-medium tracking-[-0.015em]">
                        {c.title}
                      </div>
                      {c.country && (
                        <Badge tone="muted" size="sm">
                          {c.country}
                        </Badge>
                      )}
                    </div>
                    {c.note && (
                      <div className="text-[13px] text-fg-2 leading-[1.45]">
                        {c.note}
                      </div>
                    )}
                  </div>
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
                  <Button
                    variant="icon"
                    onClick={() => handleRemove(c.id)}
                    aria-label="Remove candidate"
                    className="hover:text-err max-[780px]:justify-self-start"
                  >
                    ✕
                  </Button>
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
            <Badge tone="muted" className="block mb-1 tracking-[0.18em]">
              Admin
            </Badge>
            <div className="text-sm text-fg-2">
              Lock the top candidate to kick off planning. This can&apos;t be
              undone from here.
            </div>
          </div>
          <Button
            tone="accent"
            onClick={handleLock}
            disabled={ranked.length === 0}
          >
            Lock destination
          </Button>
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
