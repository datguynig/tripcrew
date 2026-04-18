"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { createProfile, type ProfileState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileForm />
    </Suspense>
  );
}

function ProfileForm() {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    createProfile,
    undefined,
  );
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  return (
    <div className="hero-radial min-h-screen flex items-center justify-center px-7">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-[10px] mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          <span className="w-5 h-px bg-accent" />
          One more thing
        </div>

        <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.04em] mb-[18px]">
          What should the crew call you<span className="text-accent">?</span>
        </h1>

        <p className="text-fg-2 text-base leading-[1.5] mb-8">
          This is how you&apos;ll show up on the roster, the ledger, and the
          feed.
        </p>

        <form action={action} className="grid gap-3">
          {next && <input type="hidden" name="next" value={next} />}
          <Field label="Name" name="name" hideLabel error={state?.error} required>
            <input
              type="text"
              autoFocus
              maxLength={60}
              placeholder="Your name"
              className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-3 focus:border-accent transition-colors"
            />
          </Field>
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="mt-5 uppercase tracking-[0.1em] font-semibold"
          >
            {pending ? "Saving…" : "Enter →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
