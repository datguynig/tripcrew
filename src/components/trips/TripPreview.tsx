import type { Trip } from "@/lib/types";

export type TripPreviewVariant =
  | { kind: "sample"; ribbonLabel: string }
  | {
      kind: "invite";
      inviterName: string;
      inviterAvatarUrl: string | null;
      crewMembers: { name: string; initials: string }[];
      ctaHref: string;
    };

export type TripPreviewSchedule = {
  day: string;
  place: string;
  note: string;
}[];

export type TripPreviewProps = {
  trip: Pick<
    Trip,
    "hero_title" | "city_label" | "dates_label" | "target_budget_pp" | "currency"
  > & {
    crew_size: number;
    origin: string;
    vibes: string;
  };
  schedule: TripPreviewSchedule;
  totalDays: number;
  visibleDays: number;
  variant: TripPreviewVariant;
};

function currencySymbol(code: string | null): string {
  if (code === "GBP") return "£";
  if (code === "EUR") return "€";
  return "$";
}

function formatBudget(amount: number | null, code: string | null): string {
  if (amount == null) return "—";
  return `${currencySymbol(code)}${amount.toLocaleString("en-GB")}`;
}

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function TripPreview({
  trip,
  schedule,
  totalDays,
  visibleDays,
  variant,
}: TripPreviewProps) {
  const cityHeading = trip.city_label ?? trip.hero_title ?? "Your trip";
  const lockedDays = Math.max(0, totalDays - visibleDays);
  const visibleSchedule = schedule.slice(0, visibleDays);

  const specCells: { label: string; value: string }[] = [
    { label: "Per head", value: formatBudget(trip.target_budget_pp, trip.currency) },
    { label: "Crew", value: String(trip.crew_size) },
    { label: "From", value: trip.origin },
    { label: "Vibes", value: trip.vibes },
  ];

  return (
    <article className="relative w-full bg-ink text-cream">
      {variant.kind === "invite" ? (
        <div className="w-full bg-cream text-ink px-6 md:px-10 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <InviterAvatar
              name={variant.inviterName}
              avatarUrl={variant.inviterAvatarUrl}
            />
            <div className="min-w-0 flex flex-col gap-1">
              <p className="text-[14px] md:text-[15px] leading-tight truncate">
                <strong className="font-semibold">{variant.inviterName}</strong>{" "}
                invited you to a trip.
              </p>
              <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/60">
                Skip the queue · invite-only access granted
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto shrink-0 inline-flex items-center border-2 border-ink px-4 py-2 font-mono uppercase tracking-[0.18em] text-[10px]">
            Crew invite
          </span>
        </div>
      ) : null}

      <div className="relative px-6 md:px-10 py-16 md:py-24">
        {variant.kind === "sample" ? (
          <div
            aria-hidden={false}
            className="absolute right-6 md:right-10 top-6 md:top-8 -rotate-[3deg] border-2 border-marketing-coral bg-ink px-4 py-2 font-mono uppercase tracking-[0.22em] text-[10px] md:text-[11px] text-marketing-coral z-10"
          >
            {variant.ribbonLabel}
          </div>
        ) : null}

        <div className="mx-auto max-w-[960px] flex flex-col gap-12 md:gap-16">
          <header className="flex flex-col gap-4 text-center">
            <h2 className="font-serif font-medium leading-[0.95] tracking-[-0.04em] text-[64px] sm:text-[80px] md:text-[96px]">
              {cityHeading}
            </h2>
            {trip.dates_label ? (
              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60">
                {trip.dates_label} · {totalDays} days
              </p>
            ) : (
              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60">
                {totalDays} days
              </p>
            )}
          </header>

          <dl className="grid grid-cols-2 md:grid-cols-4 border-2 border-cream/30">
            {specCells.map((cell, i) => (
              <div
                key={cell.label}
                className={[
                  "p-5 md:p-6 flex flex-col gap-2",
                  i % 2 === 1 ? "border-l-2 border-cream/30" : "",
                  i >= 2 ? "border-t-2 border-cream/30 md:border-t-0" : "",
                  i === 2 ? "md:border-l-2 md:border-cream/30" : "",
                  i === 3 ? "md:border-l-2 md:border-cream/30" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
                  {cell.label}
                </dt>
                <dd className="font-serif text-[24px] md:text-[28px] leading-[1.1] tracking-[-0.02em] break-words">
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-6">
            <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/55">
              Schedule
            </p>
            <ol className="flex flex-col gap-5">
              {visibleSchedule.map((row, i) => (
                <li
                  key={`${row.day}-${i}`}
                  className="pl-5 border-l-2 border-marketing-coral"
                >
                  <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55 mb-1.5">
                    {row.day} · {row.place}
                  </p>
                  <p className="text-[15px] md:text-[16px] leading-[1.55] text-cream/85">
                    {row.note}
                  </p>
                </li>
              ))}
            </ol>
            {lockedDays > 0 ? (
              <div className="border border-dashed border-cream/40 px-5 py-4 font-mono uppercase tracking-[0.18em] text-[10px] text-cream/45">
                {lockedDays} more days · unlock when you join
              </div>
            ) : null}
          </section>

          {variant.kind === "invite" ? (
            <CrewCounter
              members={variant.crewMembers}
              ctaHref={variant.ctaHref}
              inviterName={variant.inviterName}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function InviterAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <span
        className="shrink-0 size-10 rounded-full overflow-hidden bg-ink/10 border border-ink/15"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="shrink-0 size-10 rounded-full bg-ink text-cream flex items-center justify-center font-mono uppercase tracking-[0.1em] text-[11px]"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function CrewCounter({
  members,
  ctaHref,
  inviterName,
}: {
  members: { name: string; initials: string }[];
  ctaHref: string;
  inviterName: string;
}) {
  const next = members.length + 1;

  return (
    <section className="flex flex-col gap-7 border-t border-cream/15 pt-10">
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/55">
        {members.length} locked in · you&apos;re the {ordinal(next)}
      </p>

      <ul className="flex flex-wrap items-start gap-5">
        {members.map((m, i) => (
          <li key={`${m.initials}-${i}`} className="flex flex-col items-center gap-2 w-[64px]">
            <span className="size-14 rounded-full bg-cream text-ink flex items-center justify-center font-mono uppercase tracking-[0.08em] text-[13px]">
              {m.initials}
            </span>
            <span className="font-mono uppercase tracking-[0.16em] text-[9px] text-cream/70 truncate max-w-full">
              {firstName(m.name)}
            </span>
          </li>
        ))}
        <li className="flex flex-col items-center gap-2 w-[80px]">
          <span className="size-14 rounded-full border border-dashed border-cream/55 flex items-center justify-center font-mono uppercase tracking-[0.16em] text-[10px] text-cream/70">
            you
          </span>
          <span className="font-mono uppercase tracking-[0.16em] text-[9px] text-cream/55 text-center leading-tight">
            you&apos;d make {next}
          </span>
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        <a
          href={ctaHref}
          className="self-start inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] px-7 min-h-[52px] border-2 border-marketing-coral hover:bg-transparent hover:text-marketing-coral transition-colors duration-150"
        >
          I&apos;m in →
        </a>
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
          10 sec to join · pro is covered by {inviterName}
        </p>
      </div>

      <p className="italic text-[14px] leading-[1.55] text-cream/60 max-w-[60ch]">
        Not for you? Just close the tab. {inviterName} won&apos;t see who didn&apos;t accept.
      </p>
    </section>
  );
}

