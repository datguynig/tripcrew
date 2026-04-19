import Link from "next/link";
import { getInitials } from "@/lib/auth";
import { TripSwitcher } from "@/components/layout/TripSwitcher";
import { NotificationsBellMount } from "@/components/layout/NotificationsBellMount";
import type { Profile, Trip, TripRole } from "@/lib/types";

type SwitcherTrip = Trip & { role: TripRole };

export function TopBar({
  profile,
  trips,
}: {
  profile: Profile;
  trips: SwitcherTrip[];
}) {
  return (
    <div className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1280px] mx-auto px-7 py-[14px] flex items-center justify-between gap-5 max-[520px]:px-5 max-[520px]:gap-3">
        <TripSwitcher trips={trips} />
        <div className="flex items-center gap-3">
          <NotificationsBellMount />
          <div className="flex items-center gap-2 py-[6px] pl-3 pr-[6px] border border-line-2 rounded-full font-mono text-[11px] tracking-[0.08em] uppercase max-[520px]:gap-1 max-[520px]:pl-[6px] max-[520px]:pr-1">
            <span className="w-[22px] h-[22px] bg-fg text-bg rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0">
              {getInitials(profile.name)}
            </span>
            <span className="truncate max-w-[140px] max-[520px]:hidden">
              {profile.name}
            </span>
            <span className="w-px h-3 bg-line-2 mx-1 max-[520px]:hidden" />
            <Link
              href="/account"
              className="text-fg-3 hover:text-fg transition-colors text-[11px] tracking-[0.08em] uppercase px-[6px] py-[2px] whitespace-nowrap"
            >
              Account
            </Link>
            <form action="/sign-out" method="post">
              <button
                type="submit"
                className="bg-transparent border-0 text-fg-3 hover:text-fg cursor-pointer text-[11px] tracking-[0.08em] uppercase px-[6px] py-[2px] whitespace-nowrap"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
