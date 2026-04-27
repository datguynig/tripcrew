import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";

export async function FounderTopbarLink() {
  try {
    await requireFounder();
  } catch (err) {
    if (err instanceof FounderForbiddenError) return null;
    throw err;
  }

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .is("approved_at", null)
    .is("rejected_at", null);

  const pending = count ?? 0;

  return (
    <Link
      href="/admin/applications/queue"
      className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-2 hover:text-fg transition-colors"
    >
      Applications
      {pending > 0 && (
        <span className="bg-marketing-coral text-ink px-1.5 py-0.5 text-[10px] tabular-nums">
          {pending}
        </span>
      )}
    </Link>
  );
}
