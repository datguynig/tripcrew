import { cookies } from "next/headers";

import { ApplicationForm } from "@/components/marketing/ApplicationForm";
import { createServiceClient } from "@/lib/supabase/server";
import { DRAFT_COOKIE_NAME } from "@/lib/teaser/cookieConfig";
import { applicationEmailSchema } from "@/lib/validators/application";
import type { DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinkedDraft = Pick<DraftLead, "id" | "email" | "slug">;

async function resolveDraftFromParams(
  rawDraft: string | string[] | undefined,
): Promise<LinkedDraft | null> {
  const candidate = Array.isArray(rawDraft) ? rawDraft[0] : rawDraft;
  if (!candidate || !UUID_RE.test(candidate)) return null;

  const cookieStore = await cookies();
  const cookieDraftId = cookieStore.get(DRAFT_COOKIE_NAME)?.value;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("draft_leads")
    .select("id, email, slug")
    .eq("id", candidate)
    .maybeSingle<LinkedDraft>();

  if (error || !data) return null;

  // Trust the param when the cookie matches OR when no cookie is set
  // (cold email-link entry). Reject only when a cookie exists and points
  // at a different draft, since that signals the user is trying to attach
  // to a draft they don't own.
  if (cookieDraftId && cookieDraftId !== data.id) return null;

  return data;
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string | string[];
    draft?: string | string[];
  }>;
}) {
  const { email: rawEmail, draft: rawDraft } = await searchParams;

  const linkedDraft = await resolveDraftFromParams(rawDraft);

  // Email is honoured from the query param only when no draft is linked;
  // a linked draft always provides its own email.
  const candidate = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const parsed = candidate
    ? applicationEmailSchema.safeParse(candidate)
    : null;
  const queryEmail = parsed?.success ? parsed.data : null;
  const prefilledEmail = linkedDraft?.email ?? null;
  const email = prefilledEmail ?? queryEmail;

  const eyebrowCopy = linkedDraft
    ? "Application · 4 questions · 60 seconds"
    : "Application · 5 quick questions · 90 seconds";

  return (
    <main className="min-h-screen w-full bg-cream text-ink">
      <div className="mx-auto w-full max-w-[680px] px-6 pt-16 pb-24 md:pt-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
          {eyebrowCopy}
        </p>
        <h1 className="mt-6 mb-16 font-serif text-[42px] leading-[1.05] tracking-[-0.02em] text-ink">
          Tell us about your crew.
        </h1>
        <ApplicationForm
          email={email}
          draftLeadId={linkedDraft?.id ?? null}
          prefilledEmail={prefilledEmail}
          draftSlug={linkedDraft?.slug ?? null}
        />
      </div>
    </main>
  );
}
