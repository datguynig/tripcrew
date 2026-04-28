import { notFound } from "next/navigation";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import { createServiceClient } from "@/lib/supabase/server";
import {
  scoreApplication,
  scoreExplanation,
} from "@/lib/applications/scoring";
import { ApplicationDetail } from "@/components/admin/ApplicationDetail";
import type { Application, DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";

type DraftSummary = Pick<DraftLead, "id" | "slug" | "inputs" | "resume_token">;

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireFounder();
  } catch (err) {
    if (err instanceof FounderForbiddenError) notFound();
    throw err;
  }

  const { id } = await params;

  const supabase = createServiceClient();
  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle<Application>();

  if (!application) notFound();

  let draft: DraftSummary | null = null;
  if (application.draft_lead_id) {
    const { data } = await supabase
      .from("draft_leads")
      .select("id, slug, inputs, resume_token")
      .eq("id", application.draft_lead_id)
      .maybeSingle<DraftSummary>();
    draft = data ?? null;
  }

  const score = scoreApplication({
    trips_per_year: application.trips_per_year,
    role: application.role,
    budget_attitude: application.budget_attitude,
  });
  const explanation = scoreExplanation({
    trips_per_year: application.trips_per_year,
    role: application.role,
    budget_attitude: application.budget_attitude,
  });

  return (
    <ApplicationDetail
      application={application}
      score={score}
      scoreExplanation={explanation}
      draft={draft}
    />
  );
}
