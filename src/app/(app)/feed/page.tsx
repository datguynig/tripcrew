import { SectionHeader } from "@/components/layout/SectionHeader";

export default function FeedPage() {
  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 06"
        title="Feed."
        lead="Photos and dispatches from the trip. Paste an image URL, add a line, post. Build the record as you go."
      />
    </section>
  );
}
