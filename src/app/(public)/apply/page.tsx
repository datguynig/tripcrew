import { ApplicationForm } from "@/components/marketing/ApplicationForm";
import { applicationEmailSchema } from "@/lib/validators/application";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { email: rawEmail } = await searchParams;
  const candidate = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const parsed = candidate
    ? applicationEmailSchema.safeParse(candidate)
    : null;
  const email = parsed?.success ? parsed.data : null;

  return (
    <main className="min-h-screen w-full bg-cream text-ink">
      <div className="mx-auto w-full max-w-[680px] px-6 pt-16 pb-24 md:pt-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
          Application · 5 quick questions · 90 seconds
        </p>
        <h1 className="mt-6 mb-16 font-serif text-[42px] leading-[1.05] tracking-[-0.02em] text-ink">
          Tell us about your crew.
        </h1>
        <ApplicationForm email={email} />
      </div>
    </main>
  );
}
