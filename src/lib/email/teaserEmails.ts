import type { TeaserInputs, TeaserOutput } from "@/lib/types";

export type TeaserEmail = {
  to: string;
  subject: string;
  text: string;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://tripcrew.app";
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const CREW_LABELS: Record<TeaserInputs["crew"], string> = {
  "2": "Two of you",
  "3-4": "Three or four of you",
  "5-6": "Five or six of you",
  "7+": "Seven plus of you",
};

const WHEN_LABELS: Record<TeaserInputs["when"], string> = {
  weekend: "a long weekend",
  week: "a week",
  "two-weeks": "two weeks",
  flexible: "flexible dates",
};

const BUDGET_LABELS: Record<TeaserInputs["budget"], string> = {
  "500": "~£500pp",
  "1000": "~£1,000pp",
  "1500": "~£1,500pp",
  "2000+": "£2,000+pp",
};

function echoInputs(inputs: TeaserInputs): string {
  const crew = CREW_LABELS[inputs.crew];
  const when = WHEN_LABELS[inputs.when];
  const budget = BUDGET_LABELS[inputs.budget];
  return `${crew}, leaving ${inputs.origin}, ${when}, ${budget}.`;
}

function resumeUrl(slug: string, draftId: string, resumeToken: string): string {
  return `${siteUrl()}/api/teaser/resume?id=${draftId}&token=${resumeToken}&slug=${slug}`;
}

function unsubscribeUrl(draftId: string, resumeToken: string): string {
  return `${siteUrl()}/api/teaser/unsubscribe?id=${draftId}&token=${resumeToken}`;
}

export type BuildTeaserConfirmationInput = {
  email: string;
  draftId: string;
  resumeToken: string;
  slug: string;
  inputs: TeaserInputs;
  teaser: TeaserOutput;
};

export function buildTeaserConfirmationEmail({
  email,
  draftId,
  resumeToken,
  slug,
  inputs,
  teaser,
}: BuildTeaserConfirmationInput): TeaserEmail {
  const city = titleCaseSlug(slug);
  const resume = resumeUrl(slug, draftId, resumeToken);
  const unsubscribe = unsubscribeUrl(draftId, resumeToken);

  return {
    to: email,
    subject: `Your ${city} draft is saved.`,
    text: [
      echoInputs(inputs),
      ``,
      teaser.hero_paragraph,
      ``,
      `Pick up where you left off:`,
      resume,
      ``,
      `When you're ready, apply to unlock the full plan and book it with your crew.`,
      ``,
      `— Tripcrew`,
      ``,
      `Don't want these? Unsubscribe: ${unsubscribe}`,
    ].join("\n"),
  };
}

export type BuildDay7NudgeInput = {
  email: string;
  draftId: string;
  resumeToken: string;
  slug: string;
  foundingRemaining: number;
};

export function buildDay7NudgeEmail({
  email,
  draftId,
  resumeToken,
  slug,
  foundingRemaining,
}: BuildDay7NudgeInput): TeaserEmail {
  const city = titleCaseSlug(slug);
  const resume = resumeUrl(slug, draftId, resumeToken);
  const unsubscribe = unsubscribeUrl(draftId, resumeToken);

  return {
    to: email,
    subject: `Your ${city} draft + a heads-up on founding spots.`,
    text: [
      `Quick heads-up: ${foundingRemaining} of 500 founding spots remain.`,
      ``,
      `Founding spots are price-locked at £179/year for life. Once they're gone, that price disappears.`,
      ``,
      `Your ${city} draft is still saved. Pick it back up:`,
      resume,
      ``,
      `— Tripcrew`,
      ``,
      `Don't want these? Unsubscribe: ${unsubscribe}`,
    ].join("\n"),
  };
}

async function sendViaResend(input: TeaserEmail, label: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.TEASER_EMAIL_FROM ?? "Tripcrew <hello@tripcrew.app>";

  if (!apiKey) {
    console.warn(`[${label}] RESEND_API_KEY missing — skipping send`, {
      to: input.to,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[${label}] Resend send failed`, {
      to: input.to,
      status: response.status,
      body,
    });
    throw new Error(`${label} email send failed`);
  }
}

export async function sendTeaserConfirmation(
  input: TeaserEmail,
): Promise<void> {
  await sendViaResend(input, "teaserConfirmation");
}

export async function sendDay7Nudge(input: TeaserEmail): Promise<void> {
  await sendViaResend(input, "teaserDay7Nudge");
}

export type BuildApplicationReceivedInput = {
  email: string;
  // The originating draft's slug, used to deep-link the skip-the-queue
  // founding-checkout. When null (cold apply with no draft), the email
  // omits the founding-spot upsell rather than guessing a slug.
  slug: string | null;
};

export function buildApplicationReceivedEmail({
  email,
  slug,
}: BuildApplicationReceivedInput): TeaserEmail {
  const lines: string[] = [
    `We got your Crew Plus application for Cohort 01.`,
    ``,
    `We're reviewing in weekly batches. Expect a decision in your inbox within seven days.`,
  ];

  if (slug) {
    lines.push(
      ``,
      `Don't want to wait? Skip the queue with a founding spot. £179/year, price-locked for life, 500 limited:`,
      `${siteUrl()}/curated/${slug}/founding-checkout`,
    );
  }

  lines.push(``, `— Tripcrew`);

  return {
    to: email,
    subject: `We got your Crew Plus application for Cohort 01.`,
    text: lines.join("\n"),
  };
}

export async function sendApplicationReceived(
  input: TeaserEmail,
): Promise<void> {
  await sendViaResend(input, "applicationReceived");
}

export type BuildApplicationApprovedInput = {
  email: string;
  applicationId: string;
};

export function buildApplicationApprovedEmail({
  email,
  applicationId,
}: BuildApplicationApprovedInput): TeaserEmail {
  const checkoutUrl = `${siteUrl()}/api/applications/${applicationId}/checkout`;
  return {
    to: email,
    subject: `You're in. Crew Plus, Cohort 01.`,
    text: [
      `You're in. Welcome to Crew Plus, Cohort 01.`,
      ``,
      `Tap to set up billing and get started:`,
      checkoutUrl,
      ``,
      `Once payment lands, you'll get a sign-in link by email and we'll seed your first trip from the draft you saved.`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  };
}

export async function sendApplicationApproved(
  input: TeaserEmail,
): Promise<void> {
  await sendViaResend(input, "applicationApproved");
}

export type BuildApplicationSoftRejectedInput = {
  email: string;
};

export function buildApplicationSoftRejectedEmail({
  email,
}: BuildApplicationSoftRejectedInput): TeaserEmail {
  return {
    to: email,
    subject: `An update on your Crew Plus application.`,
    text: [
      `Thanks for applying to Tripcrew.`,
      ``,
      `We're matching applicants in waves. You're queued for the next one. We'll be in touch when there's space.`,
      ``,
      `In the meantime, a founding spot still skips the queue:`,
      `${siteUrl()}/#pricing`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  };
}

export async function sendApplicationSoftRejected(
  input: TeaserEmail,
): Promise<void> {
  await sendViaResend(input, "applicationSoftRejected");
}
