"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  ConciergeMessage,
  ConciergeProposal,
  ScheduleItem,
  TripMeta,
} from "@/lib/types";

type ApplyResult =
  | { ok: true; updated: ConciergeMessage }
  | { ok?: false; error: string };

const input = z.object({
  messageId: z.string().uuid(),
  proposalIndex: z.number().int().min(0).max(20),
});

export async function applyConciergeProposal(raw: {
  messageId: string;
  proposalIndex: number;
}): Promise<ApplyResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const service = createServiceClient();

  const { data: message } = await service
    .from("concierge_messages")
    .select("*")
    .eq("id", parsed.data.messageId)
    .maybeSingle<ConciergeMessage>();

  if (!message) return { error: "Message not found." };
  if (message.user_id !== user.id) return { error: "Not your message." };
  if (!message.proposals || !Array.isArray(message.proposals)) {
    return { error: "No proposals on this message." };
  }
  const proposal = message.proposals[parsed.data.proposalIndex];
  if (!proposal) return { error: "Proposal not found." };
  if (proposal.applied_at) return { error: "Already applied." };

  // Authorization: caller must be admin on the trip to mutate its data.
  const { data: membership } = await service
    .from("trip_members")
    .select("role")
    .eq("trip_id", message.trip_id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();

  if (!membership) return { error: "You're not on this trip." };
  if (membership.role !== "admin") {
    return { error: "Only trip admins can apply concierge proposals." };
  }

  const tripId = message.trip_id;

  switch (proposal.kind) {
    case "activity_add": {
      const { error } = await service.from("activities").insert({
        trip_id: tripId,
        title: proposal.payload.name,
        meta: proposal.payload.description,
        category: "day",
      });
      if (error) {
        console.error("applyConciergeProposal activity_add failed", error);
        return { error: "Could not add activity." };
      }
      break;
    }

    case "budget_change": {
      const { error } = await service
        .from("trips")
        .update({ target_budget_pp: proposal.payload.new_target_pp })
        .eq("id", tripId);
      if (error) {
        console.error("applyConciergeProposal budget_change failed", error);
        return { error: "Could not update budget." };
      }
      break;
    }

    case "schedule_revise": {
      const result = await applyScheduleRevise(
        service,
        tripId,
        proposal.payload.day,
        proposal.payload.slots,
      );
      if (!result.ok) return { error: result.error };
      break;
    }

    default: {
      // Exhaustiveness check.
      const _never: never = proposal;
      void _never;
      return { error: "Unsupported proposal." };
    }
  }

  // Stamp applied_at on the proposal so the UI can disable the button.
  const updatedProposals: ConciergeProposal[] = (
    message.proposals as ConciergeProposal[]
  ).map((p, i) =>
    i === parsed.data.proposalIndex
      ? { ...p, applied_at: new Date().toISOString() }
      : p,
  );

  const { data: updated, error: updateErr } = await service
    .from("concierge_messages")
    .update({ proposals: updatedProposals })
    .eq("id", message.id)
    .select("*")
    .single<ConciergeMessage>();

  if (updateErr || !updated) {
    console.error("applyConciergeProposal stamp failed", updateErr);
    return { error: "Applied but couldn't update record. Refresh." };
  }

  // Trigger overview revalidation by trip slug.
  const { data: trip } = await service
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (trip?.slug) {
    revalidatePath(`/trips/${trip.slug}`);
    revalidatePath(`/trips/${trip.slug}/concierge`);
    revalidatePath(`/trips/${trip.slug}/shortlist`);
  }

  return { ok: true, updated };
}

async function applyScheduleRevise(
  service: ReturnType<typeof createServiceClient>,
  tripId: string,
  day: number,
  slots: { time: string; title: string; note?: string }[],
): Promise<{ ok: true } | { ok?: false; error: string }> {
  const { data: trip } = await service
    .from("trips")
    .select("meta")
    .eq("id", tripId)
    .maybeSingle<{ meta: TripMeta | null }>();
  if (!trip) return { error: "Trip not found." };

  const dayLabel = `Day ${day}`;
  const existing = trip.meta?.schedule ?? [];
  const otherDays = existing.filter((row) => row.day_label !== dayLabel);
  const newRows: ScheduleItem[] = slots.map((slot) => ({
    day_label: dayLabel,
    heading: `${slot.time} · ${slot.title}`.slice(0, 120),
    body: (slot.note ?? "").slice(0, 500),
  }));
  const nextSchedule = [...otherDays, ...newRows];
  const nextMeta: TripMeta = {
    ...(trip.meta ?? {}),
    schedule: nextSchedule,
    brief_updated_at: new Date().toISOString(),
  };

  const { error } = await service
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", tripId);
  if (error) {
    console.error("applyScheduleRevise failed", error);
    return { error: "Could not update schedule." };
  }
  return { ok: true };
}
