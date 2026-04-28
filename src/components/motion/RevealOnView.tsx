"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import type { TargetAndTransition } from "motion/react";

import { PRESETS, type PresetName } from "@/lib/motion";

type RevealOnViewProps = {
  children: ReactNode;
  preset?: PresetName;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "p" | "span" | "h1" | "h2" | "h3";
  amount?: number;
  margin?: string;
  once?: boolean;
};

export function RevealOnView({
  children,
  preset = "fadeUp",
  delay = 0,
  className,
  as = "div",
  amount = 0.2,
  margin = "0px 0px -15% 0px",
  once = true,
}: RevealOnViewProps) {
  const Tag = m[as];
  const variants = PRESETS[preset];
  const visible =
    delay > 0
      ? {
          ...variants.visible,
          transition: {
            ...((variants.visible as TargetAndTransition).transition ?? {}),
            delay,
          },
        }
      : variants.visible;

  return (
    <Tag
      className={className}
      variants={{
        hidden: variants.hidden,
        visible,
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin }}
    >
      {children}
    </Tag>
  );
}
