import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { getCurrentUser, getUserTrips } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const trips = await getUserTrips();

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:items-center focus:gap-2 focus:bg-bg-2 focus:border focus:border-line-2 focus:rounded-md focus:px-[12px] focus:py-[6px] focus:text-[13px] focus:text-fg focus:no-underline"
      >
        Skip to content
        <span aria-hidden="true" className="text-accent">↓</span>
      </a>
      <TopBar profile={user.profile} trips={trips} />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-[1280px] mx-auto w-full px-7 max-[520px]:px-5"
      >
        {children}
      </main>
    </div>
  );
}
