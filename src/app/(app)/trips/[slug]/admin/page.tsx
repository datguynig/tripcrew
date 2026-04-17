import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";

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
        <AdminSection
          code="A"
          title="Identity"
          description="Name, destination, status."
        />
        <AdminSection
          code="B"
          title="Dates & budget"
          description="Start/end dates, vote deadline, target budget per head."
        />
        <AdminSection
          code="C"
          title="Hero & spec grid"
          description="The overview headline, subtitle, and the 4-cell spec grid."
        />
        <AdminSection
          code="D"
          title="Schedule"
          description="Day-by-day plan. Add, remove, reorder rows."
        />
        <AdminSection
          code="E"
          title="Section leads"
          description="Short intro under the title on Overview, Shortlist, Bookings, Ledger, Feed."
        />
        <AdminSection
          code="F"
          title="Crew management"
          description="Promote, demote, remove members. Delete the trip."
        />
      </div>
    </section>
  );
}

function AdminSection({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-line p-7">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent">
          § {code}
        </span>
        <h3 className="text-[22px] font-medium tracking-[-0.02em]">{title}</h3>
      </div>
      <p className="text-fg-2 text-[14px] mb-5 max-w-[560px]">{description}</p>
      <div className="border border-dashed border-line-2 py-8 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        Coming in the next commit
      </div>
    </div>
  );
}
