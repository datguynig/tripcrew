import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="py-14 pb-24 section-enter max-w-[560px]">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-3 mb-4">
        Account
      </div>
      <h1
        className="font-bold leading-[0.9] tracking-[-0.04em] mb-10"
        style={{ fontSize: "clamp(40px, 7vw, 64px)" }}
      >
        Password<span className="text-accent">.</span>
      </h1>

      <p className="text-fg-2 text-base leading-[1.5] mb-7">
        Set or change the password on {user.email}. Next time you sign in,
        you can use email + password instead of waiting for a magic link.
      </p>

      <PasswordForm />
    </section>
  );
}
