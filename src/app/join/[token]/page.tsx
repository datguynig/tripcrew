import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  acceptAndRedirect,
  lookupInvite,
} from "@/lib/actions/acceptInvite";
import { buttonClasses } from "@/components/ui/Button";

export const revalidate = 0;

// Server actions can write (revalidate, mutate) — render passes can't.
// We keep `lookupInvite` in render (pure read) and put the actual join
// behind a form action that fires `acceptAndRedirect`. Auto-submit via
// useEffect on the client gives the "click link → land on trip" UX
// without breaking Next 16's render purity.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lookup = await lookupInvite(token);
  if (lookup.kind !== "ok") {
    return <JoinError kind={lookup.kind} />;
  }

  if (!user) {
    const signInHref = `/sign-in?next=${encodeURIComponent(`/join/${token}`)}`;
    return (
      <div className="hero-radial min-h-screen flex items-center justify-center px-7">
        <div className="w-full max-w-[460px]">
          <div className="flex items-center gap-[10px] mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            <span className="w-5 h-px bg-accent" />
            TripCrew invite
          </div>

          <h1 className="text-[48px] font-semibold leading-[0.95] tracking-[-0.04em] mb-[14px]">
            Join {lookup.tripName}
            <span className="text-accent">.</span>
          </h1>

          <p className="text-fg-2 text-base leading-[1.5] mb-8">
            You&apos;ve been invited to this trip. Sign in or create an account
            to accept — you&apos;ll land straight on the trip when you do.
          </p>

          <Link
            href={signInHref}
            className={buttonClasses({
              size: "lg",
              className:
                "w-full uppercase tracking-[0.1em] font-semibold justify-center",
            })}
          >
            Continue →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-radial min-h-screen flex items-center justify-center px-7">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-[10px] mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          <span className="w-5 h-px bg-accent" />
          TripCrew invite
        </div>

        <h1 className="text-[48px] font-semibold leading-[0.95] tracking-[-0.04em] mb-[14px]">
          Join {lookup.tripName}
          <span className="text-accent">.</span>
        </h1>

        <p className="text-fg-2 text-base leading-[1.5] mb-8">
          You&apos;ve been invited to this trip. Click below to accept.
        </p>

        <form action={acceptAndRedirect.bind(null, token)}>
          <button
            type="submit"
            className={buttonClasses({
              size: "lg",
              className:
                "w-full uppercase tracking-[0.1em] font-semibold justify-center",
            })}
          >
            Accept &amp; join →
          </button>
        </form>
      </div>
    </div>
  );
}

function JoinError({ kind }: { kind: "invalid" | "expired" | "not_signed_in" }) {
  const label =
    kind === "expired"
      ? "Invite expired"
      : kind === "not_signed_in"
        ? "Signed out"
        : "Invalid invite";
  const body =
    kind === "expired"
      ? "This invite link has expired. Ask the trip admin for a fresh one."
      : kind === "not_signed_in"
        ? "You need to be signed in to accept. Refresh this page after signing in."
        : "This invite link isn't valid. Check the URL or ask the admin for a new one.";

  return (
    <div className="hero-radial min-h-screen flex items-center justify-center px-7">
      <div className="w-full max-w-[460px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-err mb-4">
          {label}
        </div>
        <p className="text-fg-2 text-base leading-[1.5] mb-6">{body}</p>
        <Link
          href="/"
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-3 hover:text-fg transition-colors"
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
