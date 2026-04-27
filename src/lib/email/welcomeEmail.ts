import { painEmailOpener } from "@/lib/applications/painCopy";
import type { ApplicationPain } from "@/lib/types";

export type BuildWelcomeEmailInput = {
  to: string;
  magicLinkUrl: string;
  pain: ApplicationPain;
};

export type WelcomeEmail = {
  to: string;
  subject: string;
  text: string;
};

function deriveFirstName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const raw = local.split(/[._-]/).find(Boolean) ?? "";
  if (!raw) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function buildWelcomeEmail({
  to,
  magicLinkUrl,
  pain,
}: BuildWelcomeEmailInput): WelcomeEmail {
  const firstName = deriveFirstName(to);
  const opener = painEmailOpener(pain);

  return {
    to,
    subject: `You're in, ${firstName}`,
    text: [
      opener,
      ``,
      `Tap to sign in: ${magicLinkUrl}`,
      ``,
      `One link, one tap. We'll keep your slot warm for 7 days.`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  };
}

export async function sendWelcomeEmail(input: WelcomeEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WELCOME_EMAIL_FROM ?? "Tripcrew <hello@tripcrew.app>";

  if (!apiKey) {
    console.warn("[welcomeEmail] RESEND_API_KEY missing — skipping send", {
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
    console.error("[welcomeEmail] Resend send failed", {
      to: input.to,
      status: response.status,
      body,
    });
    throw new Error("welcome email send failed");
  }
}
