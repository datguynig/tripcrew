import { BasicDraftSchema } from "@/lib/ai/schema";

type Props = {
  raw: unknown;
};

export function CandidatePlanPreview({ raw }: Props) {
  const parsed = BasicDraftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const draft = parsed.data;

  const visibleThemes = draft.themes.slice(0, 3);
  const extraThemes = draft.themes.length - visibleThemes.length;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span
          className="w-[5px] h-[5px] rounded-full bg-accent shrink-0"
          aria-hidden="true"
        />
        <span className="label-xs tracking-[0.16em] text-accent">
          AI PLAN PREVIEW
        </span>
      </div>

      <p className="text-[13px] text-fg leading-[1.5] line-clamp-3">
        {draft.summary}
      </p>

      {visibleThemes.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mt-[2px]">
          {visibleThemes.map((theme) => (
            <span
              key={theme}
              className="border border-line bg-bg/60 px-[8px] py-[2px] text-[11px] tracking-[0.04em] text-fg-2"
            >
              {theme}
            </span>
          ))}
          {extraThemes > 0 && (
            <span className="text-[11px] text-fg-3 self-center">
              +{extraThemes}
            </span>
          )}
        </div>
      )}

      <p className="text-[11px] text-fg-3 leading-[1.5] mt-[2px]">
        Lock this candidate to unlock weather, hotels, itinerary &amp; budget.
      </p>
    </div>
  );
}
