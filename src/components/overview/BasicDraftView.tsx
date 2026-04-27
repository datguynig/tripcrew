import Link from "next/link";
import type { BasicDraft } from "@/lib/ai/schema";

type Props = {
  draft: BasicDraft;
  generatedAt: string | null;
};

export function BasicDraftView({ draft, generatedAt }: Props) {
  return (
    <article className="border border-line bg-bg-2 p-7 max-[640px]:p-5 grid gap-8">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="label-sm text-fg-3 mb-2">
            BASIC PLAN · {draft.destination.toUpperCase()}
          </div>
          <h3 className="text-[28px] max-[640px]:text-[22px] font-medium tracking-[-0.025em] leading-[1.15] max-w-[640px]">
            {draft.summary}
          </h3>
        </div>
        {generatedAt && (
          <span className="label-sm text-fg-3 shrink-0">
            {formatStamp(generatedAt)}
          </span>
        )}
      </header>

      {draft.themes.length > 0 && (
        <section>
          <div className="label-sm text-fg-3 mb-3">THEMES</div>
          <div className="flex flex-wrap gap-2">
            {draft.themes.map((theme) => (
              <span
                key={theme}
                className="border border-line bg-bg px-3 py-1.5 text-[13px] text-fg-2"
              >
                {theme}
              </span>
            ))}
          </div>
        </section>
      )}

      {draft.generalTips.length > 0 && (
        <section>
          <div className="label-sm text-fg-3 mb-3">GENERAL TIPS</div>
          <ul className="grid gap-2 text-[14px] text-fg-2 leading-[1.55]">
            {draft.generalTips.map((tip, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-fg-3 shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft.upgradePrompt && (
        <aside className="border border-accent/40 bg-accent/[0.04] px-5 py-4 flex items-center gap-4 flex-wrap">
          <p className="text-[14px] text-fg-2 leading-[1.55] flex-1 min-w-[220px]">
            {draft.upgradePrompt}
          </p>
          <Link
            href="/account"
            className="label-sm-wide text-accent hover:underline shrink-0"
          >
            Upgrade →
          </Link>
        </aside>
      )}
    </article>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}
