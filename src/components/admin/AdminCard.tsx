import type { ReactNode } from "react";

type Props = {
  code: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminCard({ code, title, description, children }: Props) {
  return (
    <div className="border border-line p-7">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent">
          § {code}
        </span>
        <h3 className="text-[22px] font-medium tracking-[-0.02em]">{title}</h3>
      </div>
      <p className="text-fg-2 text-[14px] mb-6 max-w-[560px]">{description}</p>
      {children}
    </div>
  );
}

export function AdminPlaceholder() {
  return (
    <div className="border border-dashed border-line-2 py-8 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
      Coming in the next commit
    </div>
  );
}
