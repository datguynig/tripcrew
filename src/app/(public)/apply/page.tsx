import { redirect } from "next/navigation";
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
  if (!parsed?.success) {
    redirect("/");
  }

  return (
    <main className="min-h-screen w-full bg-cream text-ink">
      <div className="mx-auto w-full max-w-[680px] px-6 pt-16 pb-24 md:pt-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
          Application · 4 quick questions · 90 seconds
        </p>
        <h1 className="mt-6 mb-16 font-serif text-[42px] leading-[1.05] tracking-[-0.02em] text-ink">
          One last thing.
        </h1>
        <ApplicationForm email={parsed.data} />
      </div>
    </main>
  );
}
