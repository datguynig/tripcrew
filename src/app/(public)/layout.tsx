import type { Metadata } from "next";

import { PublicNav } from "@/components/marketing/PublicNav";

export const metadata: Metadata = {
  title: "Tripcrew. Trips that make it out of the group chat.",
  description:
    "Invite-only group trip planner. Pick a city. Pull your crew. Make memories, not just wishes.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-cream text-ink min-h-screen">
      <PublicNav />
      {children}
    </div>
  );
}
