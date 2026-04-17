import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Nav } from "@/components/layout/Nav";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar profile={user.profile} />
      <Nav />
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-7">
        {children}
      </main>
    </div>
  );
}
