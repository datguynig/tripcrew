import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type Props = {
  code: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminCard({ code, title, description, children }: Props) {
  return (
    <Card padding={7} tone="flat">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="label text-accent">§ {code}</span>
        <h3 className="title">{title}</h3>
      </div>
      <p className="text-fg-2 body mb-6 max-w-[560px]">{description}</p>
      {children}
    </Card>
  );
}

export function AdminPlaceholder() {
  return (
    <div className="border border-dashed border-line-2 py-8 text-center label text-fg-3">
      Coming in the next commit
    </div>
  );
}
