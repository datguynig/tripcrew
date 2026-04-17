import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { AdminCard, AdminPlaceholder } from "@/components/admin/AdminCard";
import { IdentitySection } from "@/components/admin/IdentitySection";

export const revalidate = 0;

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const trip = await getTrip(slug);
  if (!trip) notFound();

  const member = await getTripMember(trip.id, user.id);
  if (!member || member.role !== "admin") redirect(`/trips/${trip.slug}`);

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 07"
        title="Admin."
        lead="Edit trip identity, dates, budget, and the content shown across tabs. Changes are live for everyone in the crew."
      />

      <div className="grid gap-10">
        <AdminCard
          code="A"
          title="Identity"
          description="Name and destination. Name is shown on the topbar and dashboard; destination becomes the overview headline."
        >
          <IdentitySection
            tripId={trip.id}
            name={trip.name}
            destination={trip.destination}
          />
        </AdminCard>

        <AdminCard
          code="B"
          title="Dates & budget"
          description="Start/end dates, vote deadline, target budget per head."
        >
          <AdminPlaceholder />
        </AdminCard>

        <AdminCard
          code="C"
          title="Hero & spec grid"
          description="The overview headline, subtitle, and the 4-cell spec grid."
        >
          <AdminPlaceholder />
        </AdminCard>

        <AdminCard
          code="D"
          title="Schedule"
          description="Day-by-day plan. Add, remove, reorder rows."
        >
          <AdminPlaceholder />
        </AdminCard>

        <AdminCard
          code="E"
          title="Section leads"
          description="Short intro under the title on Overview, Shortlist, Bookings, Ledger, Feed."
        >
          <AdminPlaceholder />
        </AdminCard>

        <AdminCard
          code="F"
          title="Crew management"
          description="Promote, demote, remove members. Delete the trip."
        >
          <AdminPlaceholder />
        </AdminCard>
      </div>
    </section>
  );
}
