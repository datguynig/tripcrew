"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#curated-trips", label: "Curated trips" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const navClass = scrolled
    ? "bg-cream/95 backdrop-blur-md border-b-2 border-ink"
    : "bg-cream/55 backdrop-blur-sm border-b border-ink/15";

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-colors duration-150 ${navClass}`}
      >
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 sm:px-10 h-[64px]">
          <Link
            href="/"
            className="font-mono uppercase tracking-[0.18em] text-[13px] text-marketing-coral-deep"
            aria-label="Tripcrew home"
          >
            Tripcrew
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70 hover:text-ink transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="hidden sm:inline-flex font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70 hover:text-ink transition-colors duration-150"
            >
              Sign in
            </Link>
            <Link
              href="/apply"
              className="hidden sm:inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[11px] px-5 h-10 border-2 border-marketing-coral hover:bg-ink hover:text-cream hover:border-ink transition-colors duration-150"
            >
              Apply for an invite
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 border-2 border-ink"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <span className="sr-only">Open menu</span>
              <span aria-hidden="true" className="flex flex-col gap-[5px]">
                <span className="block w-5 h-[2px] bg-ink" />
                <span className="block w-5 h-[2px] bg-ink" />
                <span className="block w-5 h-[2px] bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="md:hidden fixed inset-0 z-50 bg-ink text-cream flex flex-col">
          <div className="flex items-center justify-between h-[64px] px-6 sm:px-10 border-b-2 border-cream/20">
            <span className="font-mono uppercase tracking-[0.18em] text-[13px] text-marketing-coral">
              Tripcrew
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center w-10 h-10 border-2 border-cream"
              aria-label="Close menu"
            >
              <span aria-hidden="true" className="text-[18px] leading-none">
                ×
              </span>
            </button>
          </div>

          <nav
            className="flex flex-col gap-1 px-6 sm:px-10 py-10 flex-1"
            aria-label="Primary mobile"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="font-serif text-[36px] leading-[1.1] tracking-[-0.02em] text-cream py-3 border-b border-cream/15 hover:text-marketing-coral transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="px-6 sm:px-10 pb-10 flex flex-col gap-3">
            <Link
              href="/apply"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] border-2 border-marketing-coral"
            >
              Apply for an invite
            </Link>
            <Link
              href="/sign-in"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center font-mono uppercase tracking-[0.18em] text-[11px] text-cream/70"
            >
              Already have an invite? Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
