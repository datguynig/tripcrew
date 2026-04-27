import { TripSwitcher } from "@/components/layout/TripSwitcher";
import { NotificationsBellMount } from "@/components/layout/NotificationsBellMount";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { PlanBadge } from "@/components/layout/PlanBadge";
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
          <PlanBadge profile={profile} />
          <NotificationsBellMount />
          <AccountMenu profile={profile} />
        </div>
      </div>
    </div>
  );
}
