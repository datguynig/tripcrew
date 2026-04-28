import type { Variants } from "motion/react";

import { duration, easeOutExpo, stagger } from "./easings";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.reveal, ease: easeOutExpo },
  },
};

export const fadeUpLarge: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.revealLong, ease: easeOutExpo },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.reveal, ease: easeOutExpo },
  },
};

export const wordReveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.reveal, ease: easeOutExpo },
  },
};

export const staggerTiles: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger.tile, delayChildren: 0.05 },
  },
};

export const staggerRows: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger.row, delayChildren: 0.05 },
  },
};

export const staggerColumns: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger.column, delayChildren: 0.1 },
  },
};

export const staggerWords: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger.word },
  },
};

export const staggerChat: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger.chat, delayChildren: 0.2 },
  },
};

export type PresetName =
  | "fadeUp"
  | "fadeUpLarge"
  | "fadeIn"
  | "wordReveal";

export const PRESETS: Record<PresetName, Variants> = {
  fadeUp,
  fadeUpLarge,
  fadeIn,
  wordReveal,
};
