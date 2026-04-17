import { SectionHeader } from "@/components/layout/SectionHeader";

export default function ShortlistPage() {
  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 03"
        title="Shortlist."
        lead="Vote yes, meh, or no. Ranked by consensus. Stuff the crew wants floats up. Tap twice to clear."
      />
    </section>
  );
}
