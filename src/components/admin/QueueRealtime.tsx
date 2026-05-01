"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function QueueRealtime({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("applications:inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        () => {
          setPulse(true);
          router.refresh();
          window.setTimeout(() => setPulse(false), 1200);
        },
      )
      .subscribe((status) => {
        // Catch-up refresh on subscribe success — applications inserted
        // between SSR and SUBSCRIBED would otherwise be invisible until
        // the next event lands or the founder navigates away. Cheap call,
        // already wraps the queue render.
        if (status !== "SUBSCRIBED") return;
        router.refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return <div className={pulse ? "animate-pulse" : ""}>{children}</div>;
}
