import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";

export const revalidate = 0;

export default async function DestinationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 00"
        title="Where to."
        lead="Propose candidates, vote, lock it in."
      />
      <div className="border border-line py-20 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        Destination voting · coming in Phase E
      </div>
    </section>
  );
}
