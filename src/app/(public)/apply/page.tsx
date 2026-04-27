import { Suspense } from "react";

import { ApplicationForm } from "@/components/marketing/ApplicationForm";

export const dynamic = "force-dynamic";

export default function ApplyPage() {
  return (
    <main className="min-h-screen w-full bg-[#f5f1e8] text-[#0a0a0a]">
      <div className="mx-auto w-full max-w-[680px] px-6 pt-16 pb-24 md:pt-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#0a0a0a]">
          Application · 4 quick questions · 90 seconds
        </p>
        <h1 className="mt-6 mb-16 font-serif text-[42px] leading-[1.05] tracking-[-0.02em] text-[#0a0a0a]">
          One last thing.
        </h1>
        <Suspense fallback={null}>
          <ApplicationForm />
        </Suspense>
      </div>
    </main>
  );
}
