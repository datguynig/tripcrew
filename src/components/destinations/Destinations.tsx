"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  castDestinationVote,
  proposeCandidate,
  removeCandidate,
  unlockDestination,
} from "@/lib/actions/destinations";
import { draftAllCandidates } from "@/lib/actions/draftCandidates";
import type {
  AiPreferences,
  DestinationCandidate,
  DestinationVote,
} from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { DestinationSearch } from "@/components/destinations/DestinationSearch";
import { CandidatePlanPreview } from "@/components/destinations/CandidatePlanPreview";
import { LockAndDraftDialog } from "@/components/destinations/LockAndDraftDialog";
import { useToast } from "@/hooks/useToast";

type Props = {
  tripId: string;
  tripSlug: string;
  initialCandidates: DestinationCandidate[];
  initialVotes: DestinationVote[];
  currentUserId: string;
  isAdmin: boolean;
  hasPro: boolean;
  crewCount: number;
  voteDeadline: string | null;
  locked: boolean;
  lockedDestination: string | null;
  aiDrafted: boolean;
  tripCurrency: string;
  tripBudgetPp: number | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  tripTargetCrewSize: number | null;
  tripPreferences: AiPreferences | null;
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
  hasPro,
  crewCount,
  voteDeadline,
  locked,
  lockedDestination,
  aiDrafted,
  tripCurrency,
  tripBudgetPp,
  tripStartDate,
  tripEndDate,
  tripTargetCrewSize,
  tripPreferences,
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
  const [draftPending, startDraftTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();

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
              const row = payload.new as Partial<DestinationCandidate> & {
                id: string;
              };
              // Merge rather than replace — defends against partial payloads
              // when a table is published without `replica identity full`.
              return prev.map((c) => (c.id === row.id ? { ...c, ...row } : c));
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
      .subscribe((status) => {
        // Catch-up fetch on subscribe success: events fired between SSR
        // response and channel SUBSCRIBED state aren't replayed by Supabase
        // Realtime, so the page-render `after()` enrichment writes can land
        // in that gap and never reach this client. Pull current state to
        // close the gap.
        if (status !== "SUBSCRIBED") return;
        void supabase
          .from("destination_candidates")
          .select(
            "id, trip_id, title, note, proposed_by, position, created_at, mapbox_id, longitude, latitude, country, photo_url, photo_attribution, basic_draft, basic_draft_generated_at",
          )
          .eq("trip_id", tripId)
          .order("position", { ascending: true })
          .returns<DestinationCandidate[]>()
          .then(({ data }) => {
            if (data) setCandidates(data);
          });
      });

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
    setLockDialogOpen(true);
  };

  const handleDraftAll = () => {
    if (!hasPro) return;
    startDraftTransition(async () => {
      const res = await draftAllCandidates({ tripId, userId: currentUserId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [];
      if (res.drafted > 0) parts.push(`${res.drafted} drafted`);
      if (res.skipped > 0) parts.push(`${res.skipped} skipped`);
      if (res.failed > 0) parts.push(`${res.failed} failed`);
      const msg = parts.length > 0 ? parts.join(" · ") : "Nothing to draft";
      if (res.failed > 0) toast.error(msg);
      else toast.success(msg);
      router.refresh();
    });
  };

  const handleUnlockConfirm = (reset: boolean) => {
    setUnlockOpen(false);
    startTransition(async () => {
      const res = await unlockDestination({ tripId, reset });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        reset
          ? "Unlocked and drafts cleared."
          : "Unlocked — back to voting.",
      );
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
                onClick={() => setUnlockOpen(true)}
                disabled={pending}
              >
                {pending ? "Unlocking…" : "Unlock"}
              </Button>
            )}
          </div>
        </div>

        <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
          <DialogContent>
            <DialogTitle>Unlock this destination?</DialogTitle>
            <DialogDescription>
              {aiDrafted
                ? "This trip has been drafted by AI. You can keep the existing hero, schedule, activities and bookings (useful if you're just tweaking), or reset them to start fresh for a new destination."
                : "The trip goes back to voting. Existing votes are kept."}
            </DialogDescription>
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnlockOpen(false)}
              >
                Cancel
              </Button>
              {aiDrafted && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUnlockConfirm(false)}
                  disabled={pending}
                >
                  Keep drafts
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleUnlockConfirm(aiDrafted)}
                disabled={pending}
              >
                {aiDrafted ? "Reset drafts" : "Unlock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
          className={`inline-flex items-center gap-2 label-sm py-[6px] px-3 rounded-full border mb-6 ${
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
            <div className="label-sm-wide text-accent mb-1">
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

      <div className="mb-8 max-w-[640px]">
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
          onSubmit={handlePropose}
          selected={selectedPlace}
          pending={pending}
        />
        {error && (
          <div className="mt-[10px] text-err font-mono text-[11px] uppercase tracking-[0.08em]">
            {error}
          </div>
        )}
      </div>

      {isAdmin && ranked.length > 0 && (
        <div className="mb-6 border border-accent/40 bg-accent/[0.04] p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-[5px] h-[5px] rounded-full bg-accent"
                aria-hidden="true"
              />
              <span className="label-sm-wide text-accent">
                {hasPro ? "AI · Plan every candidate" : "Crew Plus · Plan every candidate"}
              </span>
            </div>
            <p className="text-[14px] text-fg-2 max-w-[560px]">
              {hasPro
                ? "Draft a basic plan for every shortlisted destination so the crew can vote on plans, not just place names. The winner upgrades to a full enriched plan once you lock it."
                : "Draft a basic plan for every shortlisted destination so the crew can vote on plans, not just place names. Crew Plus unlocks this — the winner becomes a full enriched plan on lock."}
            </p>
          </div>
          {hasPro ? (
            <Button
              tone="accent"
              size="md"
              onClick={handleDraftAll}
              disabled={
                draftPending ||
                ranked.every((c) => c.basic_draft !== null)
              }
            >
              {draftPending
                ? "Drafting…"
                : ranked.every((c) => c.basic_draft !== null)
                  ? "All drafted"
                  : `Draft all (${ranked.filter((c) => c.basic_draft === null).length})`}
            </Button>
          ) : (
            <Link
              href="/account"
              className="font-mono text-[11px] tracking-[0.1em] uppercase text-accent hover:text-fg transition-colors shrink-0"
            >
              Upgrade →
            </Link>
          )}
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="border border-line py-14 text-center label text-fg-3">
          No candidates · propose one
        </div>
      ) : (
        <div className="grid grid-cols-2 max-[900px]:grid-cols-1 gap-4">
          {ranked.map((c, i) => {
            const cc = counts.get(c.id) ?? { yes: 0, maybe: 0, no: 0 };
            const total = cc.yes + cc.maybe + cc.no;
            const mine = myVote.get(c.id);
            const canRemove = isAdmin || c.proposed_by === currentUserId;
            const isLeading = i === 0 && total > 0;
            const hasCoords = c.longitude !== null && c.latitude !== null;
            const awaitingPhoto =
              !c.photo_url &&
              hasCoords &&
              Date.now() - new Date(c.created_at).getTime() < 30_000;
            // Drop the 16:9 image area entirely when there's nothing to show.
            // Coordless candidates would otherwise render a 340px void with a
            // near-invisible "No preview" label. With image suppressed the card
            // collapses to text-only and the LEADING badge moves inline.
            const showImage = !!c.photo_url || awaitingPhoto || hasCoords;
            return (
              <article
                key={c.id}
                className="relative flex flex-col bg-bg-2/70 backdrop-blur-md border border-line group"
              >
                {showImage && (
                  <div className="relative aspect-[16/9] bg-bg-3 overflow-hidden">
                    {c.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.photo_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="block w-full h-full object-cover"
                      />
                    ) : awaitingPhoto ? (
                      <div
                        className="w-full h-full bg-bg-3 animate-pulse"
                        aria-hidden
                      />
                    ) : (
                      <MapFallback
                        longitude={c.longitude!}
                        latitude={c.latitude!}
                        title={c.title}
                      />
                    )}

                    {c.photo_url && (c.photo_attribution || isLeading) && (
                      <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg/80 via-bg/40 to-transparent pointer-events-none"
                      />
                    )}

                    {isLeading && (
                      <span
                        aria-hidden
                        className="absolute top-[10px] left-[10px] font-mono text-[10px] tracking-[0.16em] bg-accent text-[#140400] px-2 py-[3px]"
                      >
                        LEADING
                      </span>
                    )}

                    {c.photo_url && c.photo_attribution && (
                      <span
                        title={`Photo: ${c.photo_attribution}`}
                        className="absolute bottom-[10px] right-[10px] max-w-[calc(100%-20px)] label-xs text-fg-2 tracking-[0.08em] pointer-events-none truncate text-right"
                      >
                        Photo · {c.photo_attribution}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-4 p-5 flex-1">
                  {!showImage && isLeading && (
                    <span
                      aria-hidden
                      className="self-start font-mono text-[10px] tracking-[0.16em] bg-accent text-[#140400] px-2 py-[3px]"
                    >
                      LEADING
                    </span>
                  )}
                  <div className="flex items-start gap-3 min-w-0">
                    <h3 className="text-[22px] font-medium tracking-[-0.02em] leading-[1.1] flex-1 min-w-0 break-words">
                      {c.title}
                    </h3>
                    {c.country && (
                      <span className="shrink-0 mt-[6px] label-xs tracking-[0.14em] text-fg-3 border border-line px-[8px] py-[3px]">
                        {c.country}
                      </span>
                    )}
                  </div>

                  {c.note && (
                    <p className="text-[13px] text-fg-2 leading-[1.5] line-clamp-2">
                      {c.note}
                    </p>
                  )}

                  {c.basic_draft != null && (
                    <CandidatePlanPreview raw={c.basic_draft} />
                  )}

                  <div className="mt-auto pt-4 border-t border-line flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex h-[3px] flex-1 min-w-[120px] bg-bg-3 overflow-hidden">
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
                      <div className="font-mono text-[10px] tracking-[0.08em] text-fg-3 tabular flex gap-[10px] shrink-0">
                        <span>
                          <b className="text-fg font-medium mr-[3px]">
                            {cc.yes}
                          </b>
                          YES
                        </span>
                        <span>
                          <b className="text-fg font-medium mr-[3px]">
                            {cc.maybe}
                          </b>
                          MEH
                        </span>
                        <span>
                          <b className="text-fg font-medium mr-[3px]">
                            {cc.no}
                          </b>
                          NO
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-[6px]">
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
                  </div>
                </div>

                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    aria-label={`Remove ${c.title}`}
                    className="absolute top-[8px] right-[8px] w-7 h-7 flex items-center justify-center text-fg-3 bg-bg/70 backdrop-blur-sm hover:text-err transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-[780px]:opacity-80"
                  >
                    ✕
                  </button>
                )}
              </article>
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
              Lock the top candidate to kick off planning. You&apos;ll capture
              trip preferences in the next step.
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

      {isAdmin && ranked.length > 0 && (
        <LockAndDraftDialog
          open={lockDialogOpen}
          onOpenChange={setLockDialogOpen}
          tripId={tripId}
          destination={ranked[0].title}
          defaultPreferences={tripPreferences}
          defaultCrewSize={tripTargetCrewSize ?? crewCount}
          defaultCurrency={tripCurrency}
          defaultBudgetPp={tripBudgetPp}
          defaultOccasion={tripPreferences?.occasion}
          tripDates={{ start: tripStartDate, end: tripEndDate }}
        />
      )}
    </>
  );
}

function MapFallback({
  longitude,
  latitude,
  title,
}: {
  longitude: number;
  latitude: number;
  title: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="label-xs text-fg-3">No preview</span>
      </div>
    );
  }
  const pin = `pin-s+FF4C15(${longitude},${latitude})`;
  const viewport = `${longitude},${latitude},4,0`;
  const src = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${viewport}/368x207@2x?access_token=${token}`;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={`Map of ${title}`}
      loading="lazy"
      className="block w-full h-full object-cover opacity-80"
    />
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
