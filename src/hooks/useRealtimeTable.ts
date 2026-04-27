"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Keyable = { id?: string | number } & Record<string, unknown>;

type Options<T> = {
  table: string;
  filter?: string;
  initial: T[];
  pk?: (row: T) => string;
  transform?: (row: Keyable) => T;
  // Pull current state when the channel reaches SUBSCRIBED. Closes the
  // SSR-to-subscription gap where realtime UPDATEs are otherwise lost
  // (Supabase doesn't replay events between mount and SUBSCRIBED).
  refetch?: () => Promise<T[]>;
};

export function useRealtimeTable<T extends Keyable>(opts: Options<T>) {
  const [rows, setRows] = useState<T[]>(opts.initial);
  const pk = opts.pk ?? ((r: T) => String(r.id));

  useEffect(() => {
    setRows(opts.initial);
  }, [opts.initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rt:${opts.table}:${opts.filter ?? "*"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: opts.table,
          filter: opts.filter,
        },
        (payload: RealtimePostgresChangesPayload<Keyable>) => {
          setRows((prev) => {
            const transform = opts.transform ?? ((r: Keyable) => r as T);
            if (payload.eventType === "INSERT") {
              const row = transform(payload.new);
              if (prev.some((r) => pk(r) === pk(row))) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = transform(payload.new);
              // Merge — defends against partial payloads when a table
              // is published without `replica identity full`.
              return prev.map((r) =>
                pk(r) === pk(row) ? ({ ...r, ...row } as T) : r,
              );
            }
            if (payload.eventType === "DELETE") {
              const oldId = String(
                (payload.old as Keyable).id ?? "",
              );
              return prev.filter((r) => String(r.id) !== oldId);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (!opts.refetch) return;
        void opts.refetch().then((data) => {
          if (data) setRows(data);
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opts.table, opts.filter, pk, opts.transform, opts.refetch]);

  return rows;
}
