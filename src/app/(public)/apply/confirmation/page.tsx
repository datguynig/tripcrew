import { redirect } from "next/navigation";
import { painMirror } from "@/lib/applications/painCopy";
import { getApplicationCount } from "@/lib/actions/applications";
import type { ApplicationPain } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAIN_VALUES: readonly ApplicationPain[] = [
  "dates",
  "booking",
  "money",
  "plan",
  "chaos",
];

function isApplicationPain(value: unknown): value is ApplicationPain {
  return (
    typeof value === "string" &&
    (PAIN_VALUES as readonly string[]).includes(value)
  );
}

export default async function ApplicationConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const { p } = await searchParams;
  const pain = Array.isArray(p) ? p[0] : p;

  if (!isApplicationPain(pain)) {
    redirect("/");
  }

  const count = await getApplicationCount();
  const formattedCount = count.toLocaleString("en-GB");

  return (
    <main className="min-h-screen w-full bg-cream text-ink flex items-center justify-center px-6 py-24">
      <article className="w-full max-w-[640px] flex flex-col items-center text-center gap-8">
        <p className="font-mono uppercase tracking-[0.22em] text-[12px] text-ink">
          Application received
        </p>

        <h1 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] tracking-[-0.01em] text-balance">
          {painMirror(pain)}
        </h1>

        <p className="font-serif text-[22px] sm:text-[24px] leading-[1.3] tracking-[-0.005em] text-balance">
          That&rsquo;s what we&rsquo;re best at.
        </p>

        <p className="font-sans text-[15px] sm:text-[16px] leading-[1.6] max-w-[480px] opacity-75 text-pretty">
          We approve in batches. Expect an invite within 14 days. Members can
          also fast-track you &mdash; if a friend&rsquo;s already on Yenkoh,
          ask them to send you one of their slots.
        </p>

        <p className="mt-8 font-mono uppercase tracking-[0.22em] text-[11px] text-ink tabular-nums">
          {formattedCount} on the list &middot; ~30 invited per week
        </p>
      </article>
    </main>
  );
}
