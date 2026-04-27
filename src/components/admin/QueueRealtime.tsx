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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return <div className={pulse ? "animate-pulse" : ""}>{children}</div>;
}
