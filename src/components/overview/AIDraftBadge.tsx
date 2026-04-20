/**
 * Subtle mono "AI" chip rendered inline on rows/cells drafted by the
 * Lock & draft flow. Purely informational — no interaction.
 *
 * Visual: 9px mono caps, `fg-3` fg, `line` border, tight padding.
 * Inline-flex so it sits flush with adjacent labels.
 *
 * Use the `dot` prop where the visual context already has a label
 * nearby (schedule row, activity row) — just a 5px dot + "AI".
 */

type Props = {
  className?: string;
  dot?: boolean;
};

export function AIDraftBadge({ className = "", dot = false }: Props) {
  if (dot) {
    return (
      <span
        className={`inline-flex items-center gap-[5px] label-xs text-fg-3 ${className}`}
        title="Drafted by AI"
      >
        <span
          className="w-[4px] h-[4px] rounded-full bg-accent"
          aria-hidden="true"
        />
        AI
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-[5px] label-xs text-fg-3 border border-line rounded-[3px] px-[6px] py-[2px] ${className}`}
      title="Drafted by AI"
    >
      <span
        className="w-[4px] h-[4px] rounded-full bg-accent"
        aria-hidden="true"
      />
      AI
    </span>
  );
}
