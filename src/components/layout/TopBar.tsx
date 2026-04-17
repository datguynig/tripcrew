import Link from "next/link";
import { getInitials } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export function TopBar({
  profile,
  tripLabel,
}: {
  profile: Profile;
  tripLabel?: string;
}) {
  return (
    <div className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1280px] mx-auto px-7 py-[14px] flex items-center justify-between gap-5">
        <Link
          href="/"
          className="flex items-center gap-[10px] font-mono text-[11px] tracking-[0.18em] uppercase text-fg hover:text-fg-2 transition-colors"
        >
          <span className="w-[7px] h-[7px] bg-accent rounded-full brand-dot" />
          {tripLabel ?? "TripCrew"}
        </Link>
        <div className="flex items-center gap-2 py-[6px] pl-3 pr-[6px] border border-line-2 rounded-full font-mono text-[11px] tracking-[0.08em] uppercase">
          <span className="w-[22px] h-[22px] bg-fg text-bg rounded-full flex items-center justify-center text-[10px] font-semibold">
            {getInitials(profile.name)}
          </span>
          <span className="truncate max-w-[140px]">{profile.name}</span>
          <form action="/sign-out" method="post">
            <button
              type="submit"
              className="bg-transparent border-0 text-fg-3 hover:text-fg cursor-pointer text-[11px] tracking-[0.08em] uppercase px-[6px] py-[2px]"
            >
              Switch
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
