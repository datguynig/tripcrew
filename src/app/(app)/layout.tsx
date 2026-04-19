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
      <TopBar profile={user.profile} trips={trips} />
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-7 max-[520px]:px-5">
        {children}
      </main>
    </div>
  );
}
