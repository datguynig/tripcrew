import Link from "next/link";
import { getUserTrips } from "@/lib/auth";

export const revalidate = 0;

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return "Dates TBD";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .toUpperCase();
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

export default async function Dashboard() {
  const trips = await getUserTrips();

  return (
    <section className="py-14 pb-24 section-enter">
      <div className="flex items-baseline justify-between mb-10">
        <h1
          className="font-bold leading-[0.9] tracking-[-0.04em]"
          style={{ fontSize: "clamp(40px, 7vw, 72px)" }}
        >
          Your trips<span className="text-accent">.</span>
        </h1>
        <Link
          href="/trips/new"
          className="bg-fg text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer"
        >
          Create trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="border border-line py-20 text-center">
          <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3 mb-4">
            No trips yet
          </div>
          <div className="text-[17px] text-fg-2 mb-6 max-w-[420px] mx-auto">
            Start planning — invite your crew, vote on the destination, split
            the money.
          </div>
          <Link
            href="/trips/new"
            className="inline-block bg-fg text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            Create your first trip
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
          {trips.map((t) => {
            const statusLabel =
              t.status === "locked" ? "LOCKED" : "PLANNING";
            const statusTone =
              t.status === "locked" ? "text-ok" : "text-warn";
            const headline = t.destination ?? t.name;
            return (
              <Link
                key={t.id}
                href={`/trips/${t.slug}`}
                className="border border-line bg-bg-2 p-6 flex flex-col gap-4 hover:border-line-2 transition-colors"
              >
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3">
                  <span className={statusTone}>{statusLabel}</span>
                  <span>{t.role === "admin" ? "ADMIN" : "MEMBER"}</span>
                </div>
                <div>
                  <div className="text-[24px] font-medium tracking-[-0.02em] leading-[1.1] mb-1">
                    {headline}
                  </div>
                  {t.destination && t.name !== t.destination && (
                    <div className="text-sm text-fg-3">{t.name}</div>
                  )}
                </div>
                <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 mt-auto">
                  {formatRange(t.start_date, t.end_date)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
