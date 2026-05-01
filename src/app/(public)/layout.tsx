import type { Metadata } from "next";

import { PublicNav } from "@/components/marketing/PublicNav";
import { ScrollProgress } from "@/components/motion";
import { MotionRoot } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Yenkoh. Trips that make it out of the group chat.",
  description:
    "Invite-only group trip planner. Pick a city. Pull your crew. Make memories, not just wishes.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionRoot>
      <div className="bg-cream text-ink min-h-screen">
        <ScrollProgress />
        <PublicNav />
        {children}
      </div>
    </MotionRoot>
  );
}
