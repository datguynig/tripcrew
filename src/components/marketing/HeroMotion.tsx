"use client";

import Image, { type ImageProps } from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { m, useScroll, useTransform, type Variants } from "motion/react";

import {
  duration,
  easeOutExpo,
  usePrefersReducedMotion,
  wordReveal,
} from "@/lib/motion";

const HEADLINE_WORDS = ["Your", "crew’s", "trip,", "fully", "planned."];

type SubheadToken = string | { italic: true; text: string };

const SUBHEAD_TOKENS: SubheadToken[] = [
  "AI",
  "drafts.",
  "Your",
  "crew",
  "picks.",
  "The",
  "trip",
  { italic: true, text: "finally" },
  "leaves",
  "the",
  "chat.",
];

const headlineContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const subheadContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.045, delayChildren: 0.7 },
  },
};

const fadeUpDelayed = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.reveal, ease: easeOutExpo, delay },
  },
});

function useClientReducedMotion(): boolean {
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted && Boolean(reduceMotion);
}

type AnimatedTextProps = {
  className?: string;
};

export function AnimatedHeadline({ className }: AnimatedTextProps) {
  return (
    <m.h1
      className={className}
      variants={headlineContainer}
      initial="hidden"
      animate="visible"
    >
      {HEADLINE_WORDS.flatMap((word, i) => {
        const wordEl = (
          <m.span
            key={`w-${i}`}
            variants={wordReveal}
            className="inline-block"
          >
            {word}
          </m.span>
        );
        return i < HEADLINE_WORDS.length - 1
          ? [wordEl, <span key={`s-${i}`}> </span>]
          : [wordEl];
      })}
    </m.h1>
  );
}

export function AnimatedSubhead({ className }: AnimatedTextProps) {
  return (
    <m.p
      className={className}
      variants={subheadContainer}
      initial="hidden"
      animate="visible"
    >
      {SUBHEAD_TOKENS.flatMap((token, i) => {
        const isString = typeof token === "string";
        const text = isString ? token : token.text;
        const italic = !isString && token.italic;
        const wordEl = (
          <m.span
            key={`w-${i}`}
            variants={wordReveal}
            className={
              italic
                ? "inline-block font-serif italic text-ink"
                : "inline-block"
            }
          >
            {text}
          </m.span>
        );
        return i < SUBHEAD_TOKENS.length - 1
          ? [wordEl, <span key={`s-${i}`}> </span>]
          : [wordEl];
      })}
    </m.p>
  );
}

export function HeroEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useClientReducedMotion();

  return (
    <m.p
      className={className}
      variants={fadeUpDelayed(0)}
      initial="hidden"
      animate="visible"
    >
      <span
        aria-hidden="true"
        className="relative inline-block w-[8px] h-[8px] mr-3 align-middle"
      >
        <span className="absolute inset-0 bg-marketing-coral-deep animate-pulse" />
        {reduceMotion ? null : (
          <m.span
            className="absolute inset-0 border-2 border-marketing-coral-deep"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{
              duration: 1.6,
              ease: easeOutExpo,
              delay: 0.45,
            }}
          />
        )}
      </span>
      {children}
    </m.p>
  );
}

export function HeroCTAGroup({
  children,
  delay = 1.4,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={fadeUpDelayed(delay)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </m.div>
  );
}

export function HeroFootnote({
  children,
  delay = 1.6,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.p
      className={className}
      variants={fadeUpDelayed(delay)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </m.p>
  );
}

export function HeroBackdrop() {
  const reduceMotion = useClientReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -60]);

  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.04]"
      aria-hidden="true"
    >
      <m.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(184,57,28,0.55)_0%,transparent_60%)]"
        style={reduceMotion ? undefined : { y }}
      />
    </div>
  );
}

export function HeroFeaturedReveal({ children }: { children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
      transition={{ duration: duration.revealLong, ease: easeOutExpo }}
    >
      {children}
    </m.div>
  );
}

export function KenBurnsImage(props: ImageProps) {
  const reduceMotion = useClientReducedMotion();

  if (reduceMotion) {
    return (
      <div className="absolute inset-0">
        <Image {...props} />
      </div>
    );
  }

  return (
    <m.div
      className="absolute inset-0 will-change-transform"
      initial={{ scale: 1.0 }}
      animate={{ scale: 1.05 }}
      transition={{
        duration: 14,
        ease: "linear",
        repeat: Infinity,
        repeatType: "mirror",
      }}
    >
      <Image {...props} />
    </m.div>
  );
}
