"use client";

import { useActionState } from "react";
import { sendMagicLink, type SignInState } from "./actions";

export default function SignInPage() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    sendMagicLink,
    undefined,
  );

  return (
    <div className="hero-radial min-h-screen flex items-center justify-center px-7">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-[10px] mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          <span className="w-5 h-px bg-accent" />
          Boys Trip · 001 · Stockholm
        </div>

        <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.04em] mb-[18px]">
          Three nights<span className="text-accent">.</span>
          <br />
          Five of us<span className="text-accent">.</span>
        </h1>

        <p className="text-fg-2 text-base leading-[1.5] mb-8">
          Stockholm, 23 – 26 July 2026. Sign in with your email to join the
          crew, vote on the plan, track the ledger, and post to the feed.
        </p>

        {state?.ok ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-2">
            Link sent. Check your inbox.
          </div>
        ) : (
          <form action={action} className="grid gap-3">
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@domain.com"
              className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-4 focus:border-accent transition-colors"
            />
            {state?.error && (
              <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
                {state.error}
              </div>
            )}
            <button
              type="submit"
              disabled={pending}
              className="bg-fg text-bg border-0 py-4 px-6 text-[13px] font-semibold uppercase tracking-[0.1em] cursor-pointer rounded-lg mt-5 hover:bg-accent transition-colors disabled:opacity-60"
            >
              {pending ? "Sending…" : "Enter →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
