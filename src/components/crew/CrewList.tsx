"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";

export type CrewRow = {
  user_id: string;
  name: string;
  member_joined_at: string;
};

type Props = {
  initial: CrewRow[];
  tripId: string;
  targetCrew: number | null;
  currentUserId: string;
};

async function loadCrew(
  supabase: ReturnType<typeof createClient>,
  tripId: string,
): Promise<CrewRow[]> {
  const { data } = await supabase
    .from("trip_members")
    .select("user_id, joined_at, profiles!trip_members_user_id_fkey(name)")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });

  if (!data) return [];
  return data.flatMap((row) => {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : (row.profiles as { name?: string } | null);
    if (!profile?.name) return [];
    return [
      {
        user_id: row.user_id,
        name: profile.name,
        member_joined_at: row.joined_at,
      },
    ];
  });
}

export function CrewList({
  initial,
  tripId,
  targetCrew,
  currentUserId,
}: Props) {
  const [rows, setRows] = useState<CrewRow[]>(initial);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const refresh = async () => setRows(await loadCrew(supabase, tripId));
    const channel = supabase
      .channel(`rt:trip_members:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${tripId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const fill = targetCrew ? Math.max(0, targetCrew - rows.length) : 0;

  return (
    <div className="border border-line">
      {rows.map((row, i) => (
        <div
          key={row.user_id}
          className={`grid grid-cols-[40px_1fr_auto] items-center py-[18px] px-6 border-b border-line last:border-b-0 gap-4 max-[520px]:grid-cols-[32px_1fr] max-[520px]:px-5 max-[520px]:[&>:last-child]:col-span-2 max-[520px]:[&>:last-child]:mt-1 ${
            row.user_id === currentUserId ? "bg-[var(--color-accent-dim)]" : ""
          }`}
        >
          <span
            aria-hidden
            className="font-mono text-[11px] tracking-[0.1em] text-fg-4"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[17px] font-medium tracking-[-0.015em]">
            {row.name}
            {row.user_id === currentUserId && (
              <Badge tone="accent" className="ml-2">You</Badge>
            )}
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-fg-3 uppercase">
            {format(new Date(row.member_joined_at), "dd MMM").toUpperCase()}
          </span>
        </div>
      ))}

      {Array.from({ length: fill }).map((_, i) => (
        <div
          key={`slot-${i}`}
          className="grid grid-cols-[40px_1fr_auto] items-center py-[18px] px-6 border-b border-line last:border-b-0 gap-4 max-[520px]:grid-cols-[32px_1fr] max-[520px]:px-5 max-[520px]:[&>:last-child]:col-span-2 max-[520px]:[&>:last-child]:mt-1 text-fg-3"
        >
          <span
            aria-hidden
            className="font-mono text-[11px] tracking-[0.1em]"
          >
            {String(rows.length + i + 1).padStart(2, "0")}
          </span>
          <span className="text-[15px] italic">Open slot</span>
          <span />
        </div>
      ))}
    </div>
  );
}
