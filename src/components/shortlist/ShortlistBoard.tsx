"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { castVote } from "@/lib/actions/shortlist";
import { useToast } from "@/hooks/useToast";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import type { Activity, Vote } from "@/lib/types";
type Props = {
  activities: Activity[];
  initialVotes: Vote[];
  currentUserId: string;
  tripId: string;
  isAdmin: boolean;
};

type Filter = "all" | "day" | "night";

export function ShortlistBoard({
  activities,
  initialVotes,
  currentUserId,
  tripId,
  isAdmin,
}: Props) {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => setVotes(initialVotes), [initialVotes]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rt:votes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        (payload) => {
          setVotes((prev) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const row = payload.new as Vote;
              const idx = prev.findIndex(
                (v) =>
                  v.activity_id === row.activity_id && v.user_id === row.user_id,
              );
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = row;
                return copy;
              }
              return [...prev, row];
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<Vote>;
              return prev.filter(
                (v) =>
                  !(
                    v.activity_id === old.activity_id &&
                    v.user_id === old.user_id
                  ),
              );
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        // Catch-up fetch on subscribe — votes that landed between SSR and
        // SUBSCRIBED would otherwise be missed forever.
        if (status !== "SUBSCRIBED") return;
        const ids = activities.map((a) => a.id);
        if (ids.length === 0) return;
        void supabase
          .from("votes")
          .select("activity_id, user_id, vote, updated_at")
          .in("activity_id", ids)
          .returns<Vote[]>()
          .then(({ data }) => {
            if (data) setVotes(data);
          });
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // Channel stays mounted once; catch-up closes over the activities
    // list as of mount, which is fine since activities are loaded once
    // by SSR and don't change while the user is on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const v of votes) {
      const row = c.get(v.activity_id) ?? { yes: 0, maybe: 0, no: 0 };
      row[v.vote]++;
      c.set(v.activity_id, row);
    }
    return c;
  }, [votes]);

  const myVote = useMemo(() => {
    const m = new Map<string, "yes" | "maybe" | "no">();
    for (const v of votes)
      if (v.user_id === currentUserId) m.set(v.activity_id, v.vote);
    return m;
  }, [votes, currentUserId]);

  const filtered = useMemo(() => {
    const list = activities.filter(
      (a) => filter === "all" || a.category === filter,
    );
    return list.sort((a, b) => {
      const ca = counts.get(a.id) ?? { yes: 0, maybe: 0, no: 0 };
      const cb = counts.get(b.id) ?? { yes: 0, maybe: 0, no: 0 };
      const sa = ca.yes * 2 + ca.maybe;
      const sb = cb.yes * 2 + cb.maybe;
      if (sb !== sa) return sb - sa;
      return a.position - b.position;
    });
  }, [activities, counts, filter]);

  const totals = {
    all: activities.length,
    day: activities.filter((a) => a.category === "day").length,
    night: activities.filter((a) => a.category === "night").length,
  };

  const handleVote = (activityId: string, next: "yes" | "maybe" | "no") => {
    const current = myVote.get(activityId);
    const vote = current === next ? null : next;
    setVotes((prev) => {
      const without = prev.filter(
        (v) => !(v.activity_id === activityId && v.user_id === currentUserId),
      );
      if (vote === null) return without;
      return [
        ...without,
        {
          activity_id: activityId,
          user_id: currentUserId,
          vote,
          updated_at: new Date().toISOString(),
        },
      ];
    });
    startTransition(async () => {
      const res = await castVote({ activityId, vote });
      if (res?.error) {
        toast.error(res.error);
        setVotes((prev) => {
          const without = prev.filter(
            (v) =>
              !(v.activity_id === activityId && v.user_id === currentUserId),
          );
          if (!current) return without;
          return [
            ...without,
            {
              activity_id: activityId,
              user_id: currentUserId,
              vote: current,
              updated_at: new Date().toISOString(),
            },
          ];
        });
      }
    });
  };

  return (
    <>
      <div className="flex gap-[6px] mb-5 flex-wrap">
        {(
          [
            ["all", "All", totals.all],
            ["day", "Day", totals.day],
            ["night", "Night", totals.night],
          ] as const
        ).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`py-[7px] px-[14px] text-xs font-medium rounded-full border cursor-pointer transition-colors ${
              filter === k
                ? "bg-fg text-bg border-fg"
                : "bg-bg-2 text-fg border-line hover:border-line-2"
            }`}
          >
            {label} {n}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-line py-14 text-center label text-fg-3">
          {activities.length === 0
            ? "Shortlist empty · activities coming soon"
            : "No activities match this filter"}
        </div>
      ) : (
      <div className="border border-line">
        {filtered.map((a) => {
          const c = counts.get(a.id) ?? { yes: 0, maybe: 0, no: 0 };
          const total = c.yes + c.maybe + c.no;
          const mine = myVote.get(a.id);
          return (
            <div
              key={a.id}
              className={`group grid grid-cols-[1fr_220px_160px] max-[780px]:grid-cols-1 items-center py-[18px] px-6 border-b border-line last:border-b-0 gap-5`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <div className="text-[17px] font-medium tracking-[-0.015em]">
                    {a.title}
                  </div>
                </div>
                {a.website_url && (
                  <a
                    href={a.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label-sm inline-flex items-center gap-1 mt-0.5 mb-1
                      text-fg-3 hover:text-fg
                      transition-colors"
                  >
                    <span>Visit website</span>
                    <ArrowUpRightIcon className="w-2.5 h-2.5" />
                  </a>
                )}
                {a.meta && (
                  <div className="text-xs text-fg-2 font-mono tracking-[0.02em]">
                    {a.meta}
                  </div>
                )}
              </div>

              <div>
                <div className="flex h-1 bg-bg-3 rounded-full overflow-hidden">
                  {total > 0 && (
                    <>
                      <div
                        className="bg-ok"
                        style={{ width: `${(c.yes / total) * 100}%` }}
                      />
                      <div
                        className="bg-warn"
                        style={{ width: `${(c.maybe / total) * 100}%` }}
                      />
                      <div
                        className="bg-err"
                        style={{ width: `${(c.no / total) * 100}%` }}
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-3 mt-2 font-mono text-[10px] tracking-[0.08em] text-fg-2">
                  <span>
                    <b className="text-fg font-medium mr-1">{c.yes}</b>YES
                  </span>
                  <span>
                    <b className="text-fg font-medium mr-1">{c.maybe}</b>MEH
                  </span>
                  <span>
                    <b className="text-fg font-medium mr-1">{c.no}</b>NO
                  </span>
                </div>
              </div>

              <div className="flex gap-1 justify-self-end max-[780px]:justify-self-start">
                <VoteBtn
                  active={mine === "yes"}
                  tone="yes"
                  onClick={() => handleVote(a.id, "yes")}
                >
                  YES
                </VoteBtn>
                <VoteBtn
                  active={mine === "maybe"}
                  tone="maybe"
                  onClick={() => handleVote(a.id, "maybe")}
                >
                  MEH
                </VoteBtn>
                <VoteBtn
                  active={mine === "no"}
                  tone="no"
                  onClick={() => handleVote(a.id, "no")}
                >
                  NO
                </VoteBtn>
              </div>
            </div>
          );
        })}
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
          : "bg-bg-2 border-line text-fg hover:border-line-2"
      }`}
    >
      {children}
    </button>
  );
}
