import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripcrew — trips that make it out of the group chat",
  description:
    "Invite-only group trip planner. Pick a city. Pull your crew. Make memories, not just wishes.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-cream text-ink">{children}</div>;
}
