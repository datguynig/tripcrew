"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import type { Variants } from "motion/react";

import {
  staggerTiles,
  staggerRows,
  staggerColumns,
  staggerWords,
  staggerChat,
} from "@/lib/motion";

type StaggerKind = "tiles" | "rows" | "columns" | "words" | "chat";

const KIND_VARIANTS: Record<StaggerKind, Variants> = {
  tiles: staggerTiles,
  rows: staggerRows,
  columns: staggerColumns,
  words: staggerWords,
  chat: staggerChat,
};

type StaggerProps = {
  children: ReactNode;
  kind?: StaggerKind;
  className?: string;
  as?: "div" | "section" | "article" | "ol" | "ul" | "dl";
  amount?: number;
  margin?: string;
  once?: boolean;
};

export function Stagger({
  children,
  kind = "rows",
  className,
  as = "div",
  amount = 0.2,
  margin = "0px 0px -15% 0px",
  once = true,
}: StaggerProps) {
  const Tag = m[as];

  return (
    <Tag
      className={className}
      variants={KIND_VARIANTS[kind]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin }}
    >
      {children}
    </Tag>
  );
}
