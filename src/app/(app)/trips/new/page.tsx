import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { NewTripForm } from "./NewTripForm";

export default async function NewTripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 00"
        title="New trip."
        lead="Name it. Dates and destination can wait. The crew can vote on those."
      />
      <NewTripForm />
    </section>
  );
}
